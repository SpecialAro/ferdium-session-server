import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import SocketIo from "socket.io";

import { customAlphabet } from "nanoid";

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

app.get("/sender", (req: Request, res: Response) => {
  // res.send("Express + TypeScript Server");
  res.sendFile(__dirname + "/html/sender.html");
});

app.get("/receiver", (req: Request, res: Response) => {
  // res.send("Express + TypeScript Server");
  res.sendFile(__dirname + "/html/receiver.html");
});

const server = app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});

const io = new SocketIo.Server(server);

const users = new Map<string, { host: string; timeout: NodeJS.Timeout }>();
const TIMEOUT = 5 * 60 * 1000;

io.on("connection", (socket) => {
  socket.on("generate-code", () => {
    const code = generateCode();
    users.set(code, {
      host: socket.id,
      timeout: setTimeout(() => {
        io.socketsLeave(code);
        users.delete(code);
        console.log(`Code ${code} has expired and been removed.`);
      }, TIMEOUT),
    });
    socket.emit("code", code);
    socket.join(code);
    console.log(users);
  });

  socket.on("join-channel", (guess: string) => {
    const user = users.get(guess);
    if (user) {
      socket.join(guess);
      socket.to(guess).emit("ready-to-send");
    } else {
      socket.emit("invalid-code");
    }
  });

  socket.on("send-file", (channel, file) => {
    socket.to(channel).emit("receive-file", file);
  });

  socket.on("disconnect", () => {
    // find all keys a user has and delete them
    const keys = Array.from(users.keys());
    for (const key of keys) {
      const user = users.get(key);
      if (user && user.host === socket.id) {
        clearTimeout(user.timeout);
        users.delete(key);
      }
    }
    console.log("user disconnected");
    console.log(users);
  });
  console.log(users);
});

function generateCode() {
  const nanoid = customAlphabet(
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
    8
  );

  return nanoid();
}
