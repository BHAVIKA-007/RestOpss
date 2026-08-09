const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  role: {
    type: String,
    enum: ["customer", "waiter", "chef", "cashier", "manager"],
    default: "customer"
  },
  phone: { type: String },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: function () {
      return ["waiter", "chef", "cashier", "manager"].includes(this.role);
    }
  },
  createdAt: { type: Date, default: Date.now }
});

UserSchema.pre("save", async function () {
  try {
    if (!this.isModified("password")) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);

  } catch (err) {
    throw err;   // Mongoose will convert it to a 500 automatically
  }
});

UserSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    return isMatch;
  } catch (err) {
    throw err;
  }
};

module.exports = mongoose.model("User", UserSchema);
