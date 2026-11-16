/* User-approved resident ELF installation, without modifying GoldHEN.
 * A manually launched ELF is an independent process; this manager exits.
 */
#include "resident_install.h"
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

#define SOURCE "/app0/bx-remote-service.elf"
#define TARGET "/data/payloads/bx-remote-service.elf"
#define TEMP "/data/payloads/bx-remote-service.elf.tmp"
#define ENABLED "/data/bx-remote-service.enabled"
#define STOP "/data/bx-remote-service.stop"
#define VERSION_FILE "/data/bx-remote-service.version"
#define RESIDENT_VERSION "0.24\n"
#define LIMIT (8u * 1024u * 1024u)

int bx_resident_prepare(void) {
    unsigned char bytes[4096];
    unsigned char magic[4];
    FILE *input=NULL,*output=NULL,*flag=NULL,*version=NULL;
    unsigned long total=0;
    size_t n;
    int result=-1;

    input=fopen(SOURCE,"rb");
    if(!input)return -1;
    if(fread(magic,1,sizeof(magic),input)!=sizeof(magic) ||
       memcmp(magic,"\x7f""ELF",4)!=0){result=-2;goto done;}
    rewind(input);
    if(mkdir("/data/payloads",0755)!=0) {
        /* Existing directory is fine; fopen provides the final check. */
        struct stat st;
        if(stat("/data/payloads",&st)!=0 || !S_ISDIR(st.st_mode)) {
            result=-3;goto done;
        }
    }
    output=fopen(TEMP,"wb");
    if(!output){result=-4;goto done;}
    while((n=fread(bytes,1,sizeof(bytes),input))>0) {
        if(total+n>LIMIT){result=-5;goto done;}
        if(fwrite(bytes,1,n,output)!=n){result=-6;goto done;}
        total+=n;
    }
    if(ferror(input)||total<4096){result=-7;goto done;}
    if(fflush(output)!=0){result=-8;goto done;}
    if(fclose(output)!=0){output=NULL;result=-9;goto done;}
    output=NULL;
    if(rename(TEMP,TARGET)!=0){result=-10;goto done;}
    /* Do not create a runnable service without local owner consent. */
    flag=fopen(ENABLED,"wb");
    if(!flag){result=-11;goto done;}
    if(fwrite("enabled_by_owner=1\n",1,19,flag)!=19){result=-12;goto done;}
    if(fclose(flag)!=0){flag=NULL;result=-13;goto done;}
    flag=NULL;
    /* The STOP flag is a user-operated kill-switch, not a service secret. */
    remove(STOP);
    /* Version marker is written ONLY after opt-in copying succeeded.
     * An older resident ELF is offered for upgrade on the next PKG launch.
     */
    version=fopen(VERSION_FILE,"wb");
    if(!version){result=-14;goto done;}
    if(fwrite(RESIDENT_VERSION,1,sizeof(RESIDENT_VERSION)-1,version)
       !=sizeof(RESIDENT_VERSION)-1){result=-15;goto done;}
    if(fclose(version)!=0){version=NULL;result=-16;goto done;}
    version=NULL;
    result=1;
done:
    if(flag)fclose(flag);
    if(version)fclose(version);
    if(output)fclose(output);
    if(input)fclose(input);
    memset(bytes,0,sizeof(bytes));
    if(result!=1)remove(TEMP);
    return result;
}
