let verbose = false;

export function setVerbose(v) {
  verbose = !!v;
}

export function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

export function dbg(msg) {
  if (verbose) {
    const ts = new Date().toISOString();
    console.error(`[${ts}] (debug) ${msg}`);
  }
}

export function die(msg, code = 1) {
  console.error(`error: ${msg}`);
  process.exit(code);
}
