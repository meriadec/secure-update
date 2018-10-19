// node dependencies
const fs = require("fs");
const crypto = require("crypto");
const request = require("request");
const assert = require("assert");
const path = require("path");

// external dependencies
const openpgp = require("openpgp");
const { autoUpdater } = require("electron-updater");
const { app } = require("electron");

const USER_DATA = app.getPath("userData");
const PUB_KEY = fs.readFileSync(path.resolve(__dirname, "pubkey.asc"), "utf-8");

// TODO support https
// TODO use our own server (gh api rate limit)
const BASE_GH_URL =
  "http://github.com/meriadec/secure-update/releases/download";

/**
 * Check if a given update matches its shasum & verify signature
 */
async function verify(version, { basePath = USER_DATA } = {}) {
  const updateFolder = path.resolve(basePath, "__update__");
  const files = await fsReadDir(updateFolder);
  const updateInfoPath = path.resolve(updateFolder, "update-info.json");
  const updateInfoContent = await fsReadFile(updateInfoPath);
  const { fileName: binaryFileName } = JSON.parse(updateInfoContent);
  const binaryFilePath = path.resolve(updateFolder, binaryFileName);
  const dl = s => dlUpdateFile(binaryFileName, updateFolder, version, s);

  // dl shasum & signature files
  //
  const [sumPath, sigPath] = await Promise.all([
    dl(".sha512sum"),
    dl(".sha512sum.sig")
  ]);

  // verify signature
  //
  const sigContent = await fsReadFile(sigPath, "ascii");
  const sumContent = await fsReadFile(sumPath, "ascii");
  const signature = await openpgp.signature.readArmored(sigContent);
  const message = openpgp.message.fromText(sumContent);
  const { keys: publicKeys } = await openpgp.key.readArmored(PUB_KEY);
  const pgpOpts = { message, publicKeys, signature };
  const verified = await openpgp.verify(pgpOpts);

  if (
    verified.signatures.length === 0 ||
    !verified.signatures.every(sig => sig.valid)
  ) {
    throw new Error("PGP SIGNATURE CHECK FAILED");
  }

  console.log(`> PGP SIGNATURE OK`);

  // verify shasum against update
  //
  const expectedSum = sumContent.split("\n")[0].split(" ")[0];
  const actualSum = await sha512sum(binaryFilePath);

  if (expectedSum !== actualSum) {
    throw new Error("CHECKSUM MISMATCH");
  }

  console.log(`> SHASUM OK`);

  return true;
}

const promisify = f => (...args) =>
  new Promise((resolve, reject) => {
    f(...args, (err, res) => {
      if (err) return reject(err);
      return resolve(res);
    });
  });

const fsReadDir = promisify(fs.readdir);
const fsReadFile = promisify(fs.readFile);

function sha512sum(filePath) {
  return new Promise((resolve, reject) => {
    const sum = crypto.createHash("sha512");
    const stream = fs.createReadStream(filePath);
    stream.on("data", data => sum.update(data));
    stream.on("end", () => resolve(sum.digest("hex")));
    stream.on("error", reject);
  });
}

function dlFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    console.log(`> Downloading ${url}`);
    const r = request({
      url,
      method: "GET",
      followAllRedirects: true
    });
    r.on("response", res => {
      if (res.statusCode !== 200) return reject(new Error(res.statusMessage));
      const file = fs.createWriteStream(outputPath);
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve(outputPath);
      });
    });
  });
}

function dlUpdateFile(originalFileName, destination, version, suffix) {
  const fileName = `${originalFileName}${suffix}`;
  const fileUrl = `${BASE_GH_URL}/v${version}/${fileName}`;
  const filePath = path.resolve(destination, fileName);
  return dlFile(fileUrl, filePath);
}

function init(msg) {
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update", () => msg("Checking for update..."));
  autoUpdater.on("update-available", info => msg("Update available."));
  autoUpdater.on("update-not-available", info => msg("Update not available."));
  autoUpdater.on("error", err => msg("Error in auto-updater. " + err));
  autoUpdater.on("download-progress", p => msg(`Downloading: ${p.percent}%`));

  autoUpdater.on("update-downloaded", async info => {
    msg("Update downloaded");

    try {
      await verify(info.version);
      msg("Update verified");
    } catch (err) {
      msg(`Error during verification: ${err.message}`);
    }

    autoUpdater.install();
  });

  autoUpdater.checkForUpdates();
}

module.exports = {
  init,
  verify
};
