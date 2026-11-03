import {requestMailbox} from '../local-ipc.mjs';
import {fileURLToPath} from 'node:url';
const name=process.argv[2];if(!['server_status','server_stop','story_start','story_pause','story_status','inventory_state','book_syntax_check','night_apply','spawn_inspect','spawn_decorate','spawn_load','spawn_unload','plan_inspect','plan_apply','server_save','journey_deploy','journey_validate','journey_status','outpost_validate','spider_migrate','encounter_gate_migrate','spawner_pace','map_probe','journey_inspect','encounter_light_fix','near_north_load','near_northeast_load','near_east_load','near_northwest_load','near_south_load','far_east_load','far_west_load','far_release','relocation_retire'].includes(name)||process.argv.length!==3)throw Error('Use one of the fixed prototype tools, without arguments');
const reply=await requestMailbox(fileURLToPath(new URL('./.director-ipc/',import.meta.url)),{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:{}}});console.log(JSON.stringify(reply));if(reply.error||reply.result?.isError)process.exitCode=1;



