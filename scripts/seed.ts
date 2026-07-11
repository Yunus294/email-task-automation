import mongoose from "mongoose";
import { seedDemoData } from "../src/database/demo-seed";

async function main() {
  const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/email-task-automation";
  await mongoose.connect(uri);
  await seedDemoData(mongoose.connection, console);
  console.log("Done");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
