import {requestMailbox} from './local-ipc.mjs';
import {commands} from './policy.mjs';
import {fileURLToPath} from 'node:url';
const name=process.argv[2],args=JSON.parse(process.argv[3]??'{}');
commands(name,args); // Reject unknown tools and arguments before local delivery.
const reply=await requestMailbox(fileURLToPath(new URL('./.director-ipc/',import.meta.url)),{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}});
console.log(JSON.stringify(reply));
if(reply.error||reply.result?.isError)process.exitCode=1;
