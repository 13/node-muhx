import express from "express";
import http from "http";
import io from "socket.io";
import path from "path";
import dayjs from "dayjs";

import isReachable from "is-reachable";
import wakeOnLan from "wake_on_lan";

const app = express();
const webServer = http.createServer(app);
const socketServer = io(webServer);
const serverPort = 3000;
var connectCounter = 0;

const socketWol = socketServer.of("/wol");

// Define the hosts object
const hosts = {
  hosts: [
    { name: "google.com", port: "80" },
    {
      name: "samstv.muh",
      port: "22",
      mac: "90:1B:0E:3E:F3:77",
      ip: "192.168.22.20",
    },
  ],
};

const showTimestamp = true;

app.use(express.static(path.join(path.resolve(), "/public")));

function getTime() {
  return showTimestamp ? dayjs().format("HH:mm:ss.SSS ") : "";
}

socketWol.on("connection", async (socket) => {
  console.log(getTime() + "socketio: wol connected");
  connectCounter++;
  console.log(getTime() + "socketio: users connected " + connectCounter);

  // disconnect user
  socket.on("disconnect", () => {
    connectCounter--;
    console.log(getTime() + "socketio: users disconnected " + connectCounter);
    clearAsyncInterval(interval);
  });

  // receive mac and wol
  socket.on("wakemac", (mac) => {
    console.log(getTime() + "wol: waking " + mac);
    if (mac != null) {
      wakeOnLan.wake(mac);
    }
  });

  // hosts ping and send
  for (let x in hosts) {
    for (let y in hosts[x]) {
      hosts[x][y].state = await isReachable(
        hosts[x][y].name + ":" + hosts[x][y].port
      );
    }
  }

  console.log(
    getTime() +
      "portal: Sending wol JSON " +
      JSON.stringify(Object.assign({}, hosts))
  );
  socketWol.emit("wol", Object.assign({}, hosts));

  // hosts interval ping and send
  var interval = setAsyncInterval(async () => {
     {
      let x;
      for (y in hosts[x]) {
        if (hosts[x][y].hasOwnProperty("ip")) {
          hosts[x][y].state = await isReachable(
            hosts[x][y].ip + ":" + hosts[x][y].port
          );
        } else {
          hosts[x][y].state = await isReachable(
            hosts[x][y].name + ":" + hosts[x][y].port
          );
        }
      }
    }
    const promise = new Promise((resolve) => {
      setTimeout(resolve("all done"), 3000);
    });
    await promise;
    //console.log(getTime() + 'portal: Sending wol JSON interval ' + JSON.stringify(Object.assign({}, menu, hosts)))
    socketWol.emit("wol", Object.assign({}, hosts));
  }, 3000);
});

// new connection
socketServer.on("connection", async (socket) => {
  var socketId = socket.id;
  var clientIp = socket.request.connection.remoteAddress;
  console.log(getTime() + "socketio: new connection " + clientIp);
});

app.get("/ping", (req, res) => {
  res.send("pong");
});

app.get("/", (req, res) => {
  res.sendFile(path.join(path.resolve(), "/public/wol.html"));
});

webServer.listen(serverPort, function () {
  console.log(getTime() + "socketio: listening on port " + serverPort);
});

// async intervals
const asyncIntervals = [];
const runAsyncInterval = async (cb, interval, intervalIndex) => {
  await cb();
  if (asyncIntervals[intervalIndex]) {
    setTimeout(() => runAsyncInterval(cb, interval, intervalIndex), interval);
  }
};

const setAsyncInterval = (cb, interval) => {
  if (cb && typeof cb === "function") {
    const intervalIndex = asyncIntervals.length;
    asyncIntervals.push(true);
    runAsyncInterval(cb, interval, intervalIndex);
    return intervalIndex;
  } else {
    throw new Error("Callback must be a function");
  }
};

const clearAsyncInterval = (intervalIndex) => {
  if (asyncIntervals[intervalIndex]) {
    asyncIntervals[intervalIndex] = false;
  }
};
