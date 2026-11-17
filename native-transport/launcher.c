/* BX standalone installer: copies only its own payload. No GoldHEN settings,
 * AutoRun, firmware changes or overwriting the existing Pair Test package. */
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <sys/stat.h>
#include <orbis/SysUtil.h>
#define TARGET "/data/payloads/bx-rp-transport.elf"
#define TEMP TARGET ".part"
static int install(void){
    FILE *input=NULL,*out=NULL;unsigned char bytes[4096];size_t n,total=0;int result=0;struct stat st;
    /* Never replace an actively authorized transport automatically. Stop it
       locally before upgrading; the installer cannot terminate other payloads. */
    if(stat("/data/bx-rp-transport.running",&st)==0)return 0;
    input=fopen("/app0/bx-rp-transport.elf","rb");if(!input)return 0;
    if(fread(bytes,1,4,input)!=4||memcmp(bytes,"\x7f""ELF",4))goto done;rewind(input);
    if(mkdir("/data/payloads",0755)!=0 && (stat("/data/payloads",&st)!=0||!S_ISDIR(st.st_mode)))goto done;
    out=fopen(TEMP,"wb");if(!out)goto done;
    while((n=fread(bytes,1,sizeof(bytes),input))>0){if(total+n>8u*1024u*1024u||fwrite(bytes,1,n,out)!=n)goto done;total+=n;}
    if(ferror(input)||total<4096||fflush(out)!=0)goto done;
    if(fclose(out)!=0){out=NULL;goto done;}out=NULL;
    if(rename(TEMP,TARGET)!=0)goto done;result=1;
done:
    if(input)fclose(input);if(out)fclose(out);if(!result)remove(TEMP);memset(bytes,0,sizeof(bytes));return result;
}
int main(void){
    /* Opening this separate installer is local consent to install its payload.
       It never starts it automatically, so a game need not keep the PKG open. */
    if(install())sceSysUtilSendSystemNotificationWithText(222,"BX Native: Payload instalado. Feche este app pelo menu PS. Inicie bx-rp-transport.elf pelo LaunchPad apos copiar a configuracao privada.");
    else sceSysUtilSendSystemNotificationWithText(222,"BX Native: Falha ao instalar payload. Nao inicie o transporte; consulte o guia.");
    for(;;)sleep(1);
}
