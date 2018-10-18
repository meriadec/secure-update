const updater = require("./updater");

async function main() {
  try {
    await updater.verify("1.0.0");
  } catch (err) {
    console.log(`> Error:`, err.message);
  }
  process.exit(0);
}

main();
