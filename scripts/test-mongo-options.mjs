/**
 * The MongoClient constructor throws on any option it doesn't recognise, and
 * it only does so at request time. This builds a real client from the same
 * options object the apps use, so a typo fails here instead of in production.
 *
 * Run with Node (not Bun): the driver's bson shim calls
 * process.getBuiltinModule('v8').startupSnapshot, which Bun does not implement.
 */
import { MongoClient } from '../apps/accounts/node_modules/mongodb/lib/index.js';
import { mongoOptions } from '../packages/config/src/mongo-options.js';

let pass = 0;
let fail = 0;

function accepts(label, dev) {
  try {
    // A dummy URI is fine — we construct only, never connect.
    const client = new MongoClient('mongodb://127.0.0.1:27017/test', mongoOptions(dev));
    void client;
    pass++;
    console.log(`  PASS  ${label}`);
  } catch (e) {
    fail++;
    console.log(`  FAIL  ${label}\n        ${e.message}`);
  }
}

console.log('\n— MongoClient accepts every option we pass —');
accepts('dev options', true);
accepts('production options', false);

console.log('\n— sanity on the values themselves —');
const prod = mongoOptions(false);
const devOpts = mongoOptions(true);

function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`); }
}

check('production keeps a warm pool', prod.minPoolSize, 1);
check('dev does not pin a connection', devOpts.minPoolSize, 0);
check('socket recycling is set', typeof prod.maxIdleTimeMS, 'number');
check('no unsupported idleTimeoutMS', 'idleTimeoutMS' in prod, false);
check('server selection stays snappy', prod.serverSelectionTimeoutMS, 5000);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);