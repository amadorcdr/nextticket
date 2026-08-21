process.env.API_BASE_URL="http://34.234.111.11:3001";
process.env.DYNAMODB_PERSISTENCE_TABLE_NAME="";
process.env.API_TIMEOUT_MS="10000";
const skill=require("/Users/angeldanielocampomartinez/Desktop/nextticket/apps/alexa-skill/index.js");
let a={};
const LOC="en-US";                       // <- locale en inglés
const E=(r)=>({version:"1.0",session:{new:false,sessionId:"s",attributes:a,application:{applicationId:"x"},user:{userId:"u"}},context:{System:{application:{applicationId:"x"},user:{userId:"u"}}},request:r});
const L=()=>({type:"LaunchRequest",requestId:"r",timestamp:new Date().toISOString(),locale:LOC});
const S=(v)=>({type:"IntentRequest",requestId:"r",timestamp:new Date().toISOString(),locale:LOC,dialogState:"IN_PROGRESS",intent:{name:"CaptureInputIntent",slots:{userInput:{name:"userInput",value:v}}}});
const R=(n,sl,d)=>({type:"IntentRequest",requestId:"r",timestamp:new Date().toISOString(),locale:LOC,dialogState:d,intent:{name:n,slots:sl||{}}});
const sl=(n,v)=>({name:n,value:v});
// Palabras que delatan que se coló español.
const ESP=/\b(evento|eventos|zona|zonas|boleto|boletos|lugares|palabra clave|disponible|consultar|deseas|tienes|hay|para el|sesión)\b/i;
async function t(l,r){
  const x=await new Promise((y,n)=>skill.handler(E(r),{},(e,z)=>e?n(e):y(z)));
  a=x.sessionAttributes||a;
  const d=String(x.response.outputSpeech.ssml).replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim();
  const sospecha=ESP.test(d.replace(/Rock en Vivo|Festival Sabor Norteño|Gira de Comedia|Sinfónica de Otoño|Arena Central|Explanada Norte|Teatro del Bosque/g,""));
  console.log(`${sospecha?"  ESPAÑOL":"  ok    "}  ${l}\n           ${d.slice(0,155)}`);
}
(async()=>{
  await t("open next ticket", L());
  await t("jaguar morado", S("jaguar morado"));
  await t("what are my events", R("GetActiveEventsIntent"));
  await t("how are sales going", R("GetTicketsSoldIntent",{eventName:sl("eventName","Rock en Vivo")},"COMPLETED"));
  await t("what zones does it have", R("GetZonesIntent",{eventName:sl("eventName",null)},"COMPLETED"));
  await t("seats in vip", R("GetSeatAvailabilityIntent",{eventName:sl("eventName",null),zoneName:sl("zoneName","VIP")},"COMPLETED"));
  await t("when is it", R("GetEventInfoIntent",{eventName:sl("eventName",null)},"COMPLETED"));
  await t("ROLE denied", R("GetTopRevenueEventIntent"));
  await t("event not found", R("GetZonesIntent",{eventName:sl("eventName","bad bunny")},"COMPLETED"));
  await t("help", R("AMAZON.HelpIntent"));
  a={};
  await t("open", L());
  await t("wrong key word", S("pinguino verde"));
  await t("stop", R("AMAZON.StopIntent"));
})();
