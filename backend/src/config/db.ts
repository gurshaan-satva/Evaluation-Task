import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

const connectToDb = async () => {
  try {
    await prisma.$connect();
    console.log("Connected to database!");
  } catch (error) {
    console.error("Error connecting to db", error);
  }
};

export default connectToDb;