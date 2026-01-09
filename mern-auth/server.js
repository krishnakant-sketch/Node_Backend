const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const app = express();
const bodyParser = require("body-parser");
const http = require("http");
const Razorpay = require("razorpay");
app.use(express.json());
app.use(cors({
  origin: "*",
}));
const Transaction = require("./models/Transaction.js");
const transactionsRoute = require("./routes/transaction.js");


app.use("/webhook/razorpay", bodyParser.raw({ type: "application/json" }));

mongoose
  .connect(
    "mongodb+srv://krishnakant_db_user:<password>@cluster0.ttpqlds.mongodb.net/mernAuth?retryWrites=true&w=majority"
  )
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// User model
const UserSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  profileImage: String,
});
const User = mongoose.model("User", UserSchema);

// Register route
const bcrypt = require("bcryptjs");
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ username, email, password: hashedPassword });
  await user.save();
  res.json({ message: "User registered successfully" });
});

// Login route
const jwt = require("jsonwebtoken");
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: "User not found" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user._id }, "secretKey", { expiresIn: "1h" });
  res.json({ token });
});

// Middleware to protect routes
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "No token" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, "secretKey", (err, decoded) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = decoded;
    next();
  });
}

// Protected route
app.get("/dashboard", authMiddleware, (req, res) => {
  res.json({ message: `Welcome user ${req.user.id}` });
});

app.use(cors());
// Upload or update profile image
// app.post("/profile", async (req, res) => {
//   const { image } = req.body; // Base64 string or URL
//   try {
//     const user = await User.findByIdAndUpdate(
//       req.user.id,
//       { profileImage: image },
//       { new: true }
//     );
//     res.json({ message: "Profile image updated", profileImage: user.profileImage });
//   } catch (err) {
//     res.status(500).json({ error: "Failed to update profile image" });
//   }
// });

const multer = require("multer");
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB

app.post("/profile", upload.single("image"), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profileImage: req.file.path }, // store file path or URL
      { new: true }
    );
    res.json({
      message: "Profile image updated",
      profileImage: user.profileImage,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile image" });
  }
});

// app.get("/profile", async (req, res) => {
//   try {
//     console.log("Fetching profile for user:", req.user.id);
//     res.json({ profileImage: "http://localhost:4000/path/to/default/image.jpg" });
//   } catch (err) {
//     res.status(500).json({ error: "Failed to fetch profile image" });
//   }
// });

app.get("/profile", authMiddleware, async (req, res) => {
  try {
    console.log("Fetching profile for user:", req.user.id);
    res.json({
      profileImage: "http://localhost:4000/path/to/default/image.jpg",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile image" });
  }
});

// make sure to install: npm install node-fetch

// app.get("/gold", async (req, res) => {
//   try {
//     const response = await fetch("https://www.goldapi.io/api/XAU/INR", {
//       method: "GET",
//       headers: {
//         "x-access-token": "goldapi-abtui9smk0tevn1-io", // your API key
//         "Content-Type": "application/json",
//       },
//     });

//     const data = await response.json();
//     res.json(data); // send gold rate to frontend
//   } catch (error) {
//     console.error("Error fetching gold rate:", error);
//     res.status(500).json({ error: "Failed to fetch gold rate" });
//   }
// });

// async function getGoldRate() {
//   const response = await fetch("https://www.goldapi.io/api/XAU/INR", {
//     method: "GET",
//     headers: {
//       "x-access-token": "goldapi-abtui9smk0tevn1-io",
//       "Content-Type": "application/json",
//     },
//   });
//   return await response.json();
// }
// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: { origin: "*" }, // allow frontend
// });

// io.on("connection", (socket) => {
//   console.log("Client connected:", socket.id); // Send updates every 60 seconds const
//   interval = setInterval(async () => {
//     try {
//       const data = await getGoldRate();
//       socket.emit("goldRateUpdate", data);
//     } catch (err) {
//       console.error("Error fetching gold rate:", err);
//     }
//   }, 60000);
//   socket.on("disconnect", () => {
//     clearInterval(interval);
//     console.log("Client disconnected:", socket.id);
//   });
// });

const razorpay = new Razorpay({
  key_id: "key_id",
  key_secret: "key_secret",
});

// Create an order (frontend calls this, then opens Razorpay Checkout)
app.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body; // amount in paise (e.g., 50000 = ₹500)
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      payment_capture: 1,
    });

    // Optionally store a placeholder transaction for tracking
    await Transaction.create({
      orderId: order.id,
      paymentId: null,
      amount: order.amount,
      currency: order.currency,
      status: "created",
    });

    res.json(order);
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Razorpay webhook endpoint
app.post("/webhook/razorpay", async (req, res) => {
  const razorpayWebhookSecret = "Krishna@8989"; // from Razorpay dashboard

  // Verify signature
  const signature = req.headers["x-razorpay-signature"];
  const body = req.body; // raw buffer (bodyParser.raw)
  const expected = crypto
    .createHmac("sha256", razorpayWebhookSecret)
    .update(body)
    .digest("hex");

  if (signature !== expected) {
    console.warn("Webhook signature mismatch");
    return res.status(400).send("Invalid signature");
  }

  // Parse JSON after verification
  const event = JSON.parse(body.toString());

  try {
    // Handle payment captured
    if (event.event === "payment.captured") {
      const p = event.payload.payment.entity;

      const tx = await Transaction.findOneAndUpdate(
        { paymentId: p.id },
        {
          paymentId: p.id,
          orderId: p.order_id,
          amount: p.amount,
          currency: p.currency,
          status: "success",
          method: p.method,
          email: p.email,
          contact: p.contact,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      io.emit("transactionUpdate", tx);
      console.log("Payment success:", p.id);
    }

    // Handle payment failed
    if (event.event === "payment.failed") {
      const p = event.payload.payment.entity;

      const tx = await Transaction.findOneAndUpdate(
        { paymentId: p.id },
        {
          paymentId: p.id,
          orderId: p.order_id,
          amount: p.amount,
          currency: p.currency,
          status: "failed",
          method: p.method,
          email: p.email,
          contact: p.contact,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      io.emit("transactionUpdate", tx);
      console.log("Payment failed:", p.id);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook handling error:", err);
    res.status(500).send("Webhook processing failed");
  }
});

// REST route for initial list
app.use("/transactions", transactionsRoute);

// Socket.IO connection (optional logs)
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});


// server.listen(5000, () => console.log("WebSocket server running on port 5000"));

app.listen(4000, () => console.log("Server running on port 4000"));
