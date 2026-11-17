import test from 'node:test';import assert from 'node:assert/strict';import worker,{BXNativeRoom} from './worker.mjs';
const C='a'.repeat(64),P='b'.repeat(64),BASE='https://native.example';
function setup(){const env={BX_PLAYER_KEY:P,BX_CONSOLE_KEY:C};const r=new BXNativeRoom({},env);env.NATIVE_ROOM={get:()=>r,idFromName:n=>n};return {r,call:(path,key,body='')=>worker.fetch(new Request(BASE+path,{method:'POST',headers:{Authorization:'Bearer '+key,Origin:BASE},body}),env)};}
test('direct signaling isolates roles, expires offers and keeps SDP out of URLs',async()=>{const {r,call}=setup();try{
 assert.equal((await call('/direct-poll',P)).status,401);assert.equal((await call('/direct-offer',C,'v=0\r\n')).status,401);
 await call('/direct-poll',C);assert.deepEqual(await(await call('/direct-status',P)).json(),{available:true,scope:'lan'});
 await call('/session',P);await call('/direct-poll',C);assert.deepEqual(await(await r.fetch(new Request(BASE+'/session-status',{headers:{Authorization:'Bearer '+P}}))).json(),{nativeOnline:false});const {id}=await(await call('/direct-offer',P,'v=0\r\ns=fixture\r\n')).json();assert.match(id,/^[a-f0-9]{64}$/);
 assert.equal(await(await call('/direct-poll',C)).text(),id+'\nv=0\r\ns=fixture\r\n');
 assert.deepEqual(await(await call('/direct-result',P,id)).json(),{ready:false});assert.equal((await call('/direct-answer',C,'0'.repeat(64)+'\nv=0\r\n')).status,409);
 await call('/direct-answer',C,id+'\nv=0\r\ns=answer\r\n');assert.deepEqual(await(await call('/direct-result',P,id)).json(),{ready:true,answer:'v=0\r\ns=answer\r\n'});
 r.session.directOffer.expiresAt=Date.now()-1;assert.equal((await call('/direct-result',P,id)).status,410);
 }finally{r.close();}});
test('new sessions cannot retrieve old direct offers and invalid/large signaling is rejected',async()=>{const {r,call}=setup();try{
 await call('/session',P);assert.equal((await call('/direct-offer',P,'not sdp')).status,400);assert.equal((await call('/direct-offer',P,'v=0\r\n'+'x'.repeat(16450))).status,413);
 const {id}=await(await call('/direct-offer',P,'v=0\r\n')).json();await call('/session',P);assert.equal((await call('/direct-result',P,id)).status,410);
 }finally{r.close();}});
