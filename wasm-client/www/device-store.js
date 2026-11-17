/* Private, local browser profile. No network requests; no PIN or Account-ID. */
(function(root,factory){if(typeof module==='object')module.exports=factory(require('./core.js'));else root.BXDeviceStore=factory(root.BXNativeCore);})(globalThis,core=>{
  function create(indexedDB,name='bx-native-device-v1'){
    function open(){return new Promise((resolve,reject)=>{
      if(!indexedDB){reject(new Error('storage_unavailable'));return;}
      let request,finished=false;
      try{request=indexedDB.open(name,1);}catch{reject(new Error('storage_unavailable'));return;}
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('profiles'))request.result.createObjectStore('profiles');};
      request.onsuccess=()=>{if(finished){request.result.close();return;}finished=true;resolve(request.result);};
      request.onerror=request.onblocked=()=>{if(!finished){finished=true;reject(new Error('storage_unavailable'));}};
    });}
    async function transaction(mode,operation){const db=await open();return new Promise((resolve,reject)=>{
      let value=null,finished=false,tx;
      function fail(){if(finished)return;finished=true;db.close();reject(new Error('storage_unavailable'));}
      try{tx=db.transaction('profiles',mode);const request=operation(tx.objectStore('profiles'));request.onsuccess=()=>{value=request.result;};request.onerror=fail;
        tx.oncomplete=()=>{if(finished)return;finished=true;db.close();resolve(value);};tx.onerror=tx.onabort=fail;
      }catch{fail();}
    });}
    return Object.freeze({
      async read(){const value=await transaction('readonly',store=>store.get('ps4'));return value==null?null:core.deviceProfile(value);},
      async save(value){const safe=core.deviceProfile(value);await transaction('readwrite',store=>store.put(safe,'ps4'));return safe;},
      async clear(){await transaction('readwrite',store=>store.delete('ps4'));}
    });
  }
  return Object.freeze({create});
});
