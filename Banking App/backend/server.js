const express = require("express");
const app = express();
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo");
require("dotenv").config({ path: "./config.env" });

const port = process.env.PORT;
const dbo = require("./db/conn");

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    methods: "GET, HEAD, PUT, PATCH, POST, DELETE",
    credentials: true,
    optionsSuccessStatus: 204,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(
  session({
    secret: "keyboard cat",
    saveUninitialized: false,
    resave: false,
    store: MongoStore.create({
      mongoUrl: process.env.ATLAS_URI,
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

app.use(express.json());
app.use(require("./routes/record"));
app.use(require("./routes/session"));
app.use("/bank", require("./routes/bank"));
app.use(require("./routes/bank_other"));


// Only start listening after DB is connected
dbo.connectToServer((err) => {
  if (err) {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  }
  console.log("MongoDB connected. Starting server...");
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
});
