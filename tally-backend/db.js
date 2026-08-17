/*
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "postgres",        
  password: "root",
  database: "Tally12",
});

export default pool;

*/
/*

import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default pool;

*/
import pkg from "pg";

const { Pool } = pkg;

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:crm%40123@localhost:5433/Tally12";
const isLocalhost = dbUrl.includes("localhost");
const pool = new Pool({
  connectionString: dbUrl,
  ssl: isLocalhost ? false : {
    rejectUnauthorized: false
  }
});

export default pool;