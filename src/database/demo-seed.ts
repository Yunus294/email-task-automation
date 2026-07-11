import { Connection } from "mongoose";

type SeedLogger = { log: (message: string) => void };

export async function seedDemoData(connection: Connection, logger?: SeedLogger) {
  const companies = connection.collection("companies");
  const users = connection.collection("users");

  const existing = await companies.countDocuments();
  if (existing > 0) {
    logger?.log("Seed skipped, companies already exist");
    return;
  }

  const acme = await companies.insertOne({
    name: "Acme Digital",
    apiKey: "acme-dev-key",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const globex = await companies.insertOne({
    name: "Globex Media",
    apiKey: "globex-dev-key",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await users.insertMany([
    {
      companyId: acme.insertedId,
      name: "Sara Karimova",
      emails: ["sara@acme.uz"],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      companyId: acme.insertedId,
      name: "Tom Weber",
      emails: ["tom@acme.uz", "tom.weber@acme.uz"],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      companyId: globex.insertedId,
      name: "Lena Fischer",
      emails: ["lena@globex.io"],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  logger?.log("Seeded 2 companies and 3 users");
  logger?.log("Acme Digital api key: acme-dev-key (sara@acme.uz, tom@acme.uz)");
  logger?.log("Globex Media api key: globex-dev-key (lena@globex.io)");
}
