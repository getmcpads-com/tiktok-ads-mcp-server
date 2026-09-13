/** Copyright 2026 GetMCPAds. SPDX-License-Identifier: Apache-2.0 */
import {createHash} from "node:crypto";
import {z} from 'zod';
import type {ToolShape} from '../../tool-quality.js';
import specs from './generated/tiktok-write-specs.json';
import {tiktokWriteApi} from './write-api.js';
type Row=Record<string,any>;
type Collector={tool:(name:string,description:string,shape:ToolShape,handler:(args:Row)=>Promise<unknown>)=>void};
const id=z.string().regex(/^\d+$/).describe('Exact TikTok numeric ID as a string, never a rounded JavaScript number.');
const json=z.record(z.unknown());
const moneyKeys=new Set(['budget','min_budget','bid_price','conversion_bid_price','deep_cpa_bid','deep_cpabid','keyword_bid']);
const controlled=new Set(['advertiser_id','operation_status','access_token','Access-Token','__proto__','constructor','prototype']);
const models=specs.models as Record<string,Record<string,{type:string,array:boolean,required:boolean,description?:string}>>;
const summaries:Record<string,string>={
 campaign_name:'Exact campaign business name.',adgroup_name:'Exact ad group business name.',ad_name:'Exact ad business name, independent of the uploaded filename.',
 campaign_id:'Existing parent campaign ID in this advertiser.',adgroup_id:'Existing ad group ID in this advertiser.',ad_id:'Existing ad ID in this advertiser and ad group.',
 objective_type:'Native campaign objective. Eligibility depends on the advertiser, campaign family and destination.',
 keyword_bid:'Keyword bid in account currency; requires the actual currency outside configuration, including on nested keyword-only updates.',
 budget:'Amount in the advertiser currency. Do not multiply by 100. Supply currency outside configuration.',budget_mode:'Native budget mode; campaign and ad group budget models must be compatible.',
 optimization_goal:'Native optimization goal, e.g. CLICK, CONVERT, REACH or ENGAGED_VIEW. Must match the campaign objective and billing_event.',
 billing_event:'Native billing event, e.g. CPC for CLICK, OCPM for CONVERT, CPM for REACH, CPV for ENGAGED_VIEW.',
 location_ids:'Explicit geographic targeting IDs returned by TikTok targeting catalogs; do not invent country IDs.',
 schedule_start_time:'Delivery start: ISO 8601 with offset, or native YYYY-MM-DD HH:MM:SS explicitly in UTC. Converted to UTC for TikTok.',
 schedule_end_time:'Delivery end: ISO 8601 with offset or native UTC; must follow start.',schedule_type:'SCHEDULE_START_END requires both dates. SCHEDULE_FROM_NOW requires a start.',
 targeting_spec:'Complete Smart+ targeting specification. Existing targeting must be read before edits; arrays replace supplied fields.',
 dayparting:'Exactly 336 binary digits describing half-hour slots across a week, in the advertiser timezone.',
 identity_type:'TikTok identity type. Spark Ads require an authorized TikTok identity/post; CUSTOM eligibility varies.',
 identity_id:'Authorized identity ID accessible to this advertiser.',tiktok_item_id:'Authorized TikTok post ID for Spark Ads. A media-library video ID cannot substitute for it.',
 image_ids:'Uploaded TikTok image IDs, not URLs.',video_id:'Uploaded TikTok video ID, not a preview URL.',
 request_id:'Caller-generated unique request identifier. Preserve it when reconciling an uncertain outcome; do not blindly retry.',
};
function modelSchema(model:string):z.ZodObject<any>{
 const shape:ToolShape={};
 for(const[key,f]of Object.entries(models[model]||{})){
  if(controlled.has(key))continue;
  let field:z.ZodTypeAny;
  if(models[f.type])field=modelSchema(f.type);
  else if(f.type==='String')field=z.string();
  else if(f.type==='Number')field=z.number().finite();
  else if(f.type==='Boolean')field=z.boolean();
  else field=json;
  if(key.endsWith('_id')&&f.type==='Number')field=id;
  if(key==='match_type'&&['AdgroupcreateSearchKeywords','AdgroupupdateSearchKeywords'].includes(model))field=z.enum(['PHRASE_WORD','PRECISE_WORD','BROAD_WORD']);
  if(f.array)field=z.array(field).max(100);
  if(!f.required||['budget','budget_mode'].includes(key))field=field.optional();
  shape[key]=field.describe(summaries[key]||f.description||`Native TikTok ${key.replaceAll('_',' ')}. Check the current entity and applicable objective before supplying it.`);
 }
 // Current contract supplements the generated SDK: portal/docs?id=1843312852800706
 // and portal/docs?id=1843314887930946 (checked 2026-09-07).
 if(model==='SmartPlusCampaignCreateBody'){
  shape.objective_type=z.enum(['APP_PROMOTION','WEB_CONVERSIONS','LEAD_GENERATION']);
  shape.is_search_campaign=z.boolean().optional().describe('Upgraded Smart+ Search, requires advertiser allowlisting and budget_optimize_on:false. Not classic Traffic Search.');
  shape.budget_optimize_on=z.boolean().optional().describe('Smart+ defaults to CBO enabled. Set false explicitly for ad group budgets or Search.');
  shape.budget_mode=z.enum(['BUDGET_MODE_DYNAMIC_DAILY_BUDGET','BUDGET_MODE_TOTAL','BUDGET_MODE_INFINITE','BUDGET_MODE_DAY']).optional().describe('With CBO: dynamic daily (default) or lifetime. Without CBO: infinite (default), daily or lifetime campaign limit.');
 }
 if(['SmartPlusCampaignCreateBody','SmartPlusAdgroupCreateBody'].includes(model))shape.request_id=z.string().regex(/^[1-9][0-9]{0,18}$/).refine(v=>/^[1-9][0-9]{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n,'request_id must fit a positive signed 64-bit integer.').describe('Stable positive 64-bit integer written as a decimal string, not a UUID. Preserve it when reconciling the same operation.');
 // Current create contract and the accepted production payload; absent from the SDK snapshot.
 // https://business-api.tiktok.com/portal/docs?id=1843317390059522
 if(model==='SmartPlusAdCreateBodyAdConfiguration'){
  shape.creative_auto_add_toggle=z.boolean().optional().describe('Set false to keep only the selected assets. Omitting this lets TikTok choose its advertiser-specific default.');
  shape.creative_auto_enhancement_strategy_list=z.array(z.enum(['TRANSLATE_AND_DUB','MUSIC_REFRESH','VIDEO_QUALITY','IMAGE_QUALITY','IMAGE_RESIZE'])).max(5).optional().describe('Explicit automatic enhancements. Use [] to disable them and preserve the supplied media; omission uses TikTok defaults.');
  shape.product_info_enabled=z.enum(['UNSET','NON_CATALOG','CATALOG']).optional().describe('UNSET disables product information overlays. Other modes require the corresponding TikTok product configuration.');
 }
 return z.object(shape).strict();
}
function guard(value:unknown,depth=0):void{
 if(depth>14)throw new Error('Configuration is too deeply nested.');
 if(value&&typeof value==='object')for(const[k,v]of Object.entries(value)){
  if(controlled.has(k))throw new Error(`Controlled field ${k} cannot be supplied inside configuration.`);
  guard(v,depth+1);
 }
}
function utc(value:string):string{
 const native=/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value);
 if(!native&&!/T.*(?:Z|[+-]\d\d:\d\d)$/.test(value))throw new Error('Dates require an explicit timezone offset or the documented native UTC format.');
 const calendar=value.slice(0,10);
 if(!/^\d{4}-\d\d-\d\d$/.test(calendar)||new Date(calendar+'T00:00:00Z').toISOString().slice(0,10)!==calendar)throw new Error('Invalid calendar date.');
 const d=new Date(native?value.replace(' ','T')+'Z':value);if(!Number.isFinite(d.getTime()))throw new Error('Invalid schedule date.');
 const result=d.toISOString().slice(0,19).replace('T',' ');if(native&&result!==value)throw new Error('Invalid calendar date.');return result;
}
function validateSettings(p:Row,a:Row,create:boolean,level:string){
 guard(p);
 const checkMoney=(value:unknown):void=>{if(!value||typeof value!=='object')return;for(const [k,v]of Object.entries(value)){if(moneyKeys.has(k)&&v!==undefined){if(!a.currency)throw new Error('Supply the actual advertiser currency for monetary settings.');if(typeof v!=='number'||v<0||!Number.isFinite(v))throw new Error(`${k} must be non-negative.`);}else checkMoney(v);}};
 checkMoney(p);
 for(const k of ['schedule_start_time','schedule_end_time'])if(p[k])p[k]=utc(p[k]);
 if(p.schedule_start_time&&p.schedule_end_time&&p.schedule_end_time<=p.schedule_start_time)throw new Error('Schedule end must be after start.');
 if(create&&level==='adgroup'&&p.schedule_type==='SCHEDULE_START_END'&&!p.schedule_end_time)throw new Error('SCHEDULE_START_END requires an end time.');
 if(p.dayparting&&!/^[01]{336}$/.test(p.dayparting))throw new Error('dayparting must contain exactly 336 binary slots.');
 if(p.bid_type==='BID_TYPE_NO_BID'&&Number(p.bid_price)>0)throw new Error('Automatic bidding cannot include a bid price.');
 const billing:Record<string,string>={CLICK:'CPC',CONVERT:'OCPM',REACH:'CPM',SHOW:'CPM',ENGAGED_VIEW:'CPV',ENGAGED_VIEW_FIFTEEN:'CPV',INSTALL:'OCPM',VALUE:'OCPM',LEAD_GENERATION:'OCPM',TRAFFIC_LANDING_PAGE_VIEW:'OCPM'};
 if(p.optimization_goal&&p.billing_event&&billing[p.optimization_goal]&&billing[p.optimization_goal]!==p.billing_event)throw new Error(`The billing event for ${p.optimization_goal} must be ${billing[p.optimization_goal]}.`);
 if(create&&level==='adgroup'&&!(p.location_ids?.length||p.targeting_spec?.location_ids?.length))throw new Error('Explicit location targeting is required; no geography is assumed.');
 const creatives=p.creatives||p.creative_list?.map((x:Row)=>x.creative_info)||[];
 if(level==='ad'&&create&&!creatives.length)throw new Error('Supply at least one creative.');
 for(const c of creatives){
  if(!c.ad_name&&p.creatives&&create)throw new Error('Every ad requires its business ad_name.');
  if(create&&c.ad_format==='SINGLE_VIDEO'&&!c.video_id&&!c.video_info?.video_id&&!c.tiktok_item_id)throw new Error('A video creative needs an uploaded video or authorized Spark post.');
  if(create&&['SINGLE_IMAGE','CAROUSEL_ADS'].includes(c.ad_format)&&!c.image_ids?.length&&!c.image_info?.length)throw new Error('An image creative needs uploaded image IDs.');
 }
}
const modes={confirm:z.boolean().optional().describe('Apply only when true. Default is a local preview without any TikTok call. Never retry an uncertain POST automatically.')};
const currency=z.string().regex(/^[A-Z]{3}$/).optional().describe('Actual advertiser currency, required when configuration contains monetary amounts. Verified before any write.');
const output=(value:unknown,isError=false)=>({...(isError?{isError:true}:{}),content:[{type:'text' as const,text:JSON.stringify(value,null,2)}]});
export const TIKTOK_EXTENDED_WRITES=[
 'tiktok_create_campaign_advanced','tiktok_update_campaign_configuration','tiktok_create_adgroup','tiktok_update_adgroup_configuration','tiktok_create_ads','tiktok_update_ads',
 'tiktok_create_smart_plus_campaign','tiktok_update_smart_plus_campaign','tiktok_create_smart_plus_adgroup','tiktok_update_smart_plus_adgroup','tiktok_create_smart_plus_ad','tiktok_update_smart_plus_ad',
 'tiktok_update_ad_status','tiktok_update_smart_plus_campaign_status','tiktok_update_smart_plus_adgroup_status','tiktok_update_smart_plus_ad_status','tiktok_update_smart_plus_material_status',
 'tiktok_rename_campaign','tiktok_rename_adgroup','tiktok_rename_ad','tiktok_upload_ad_image','tiktok_upload_ad_video',
];
export function registerTikTokExtendedWrites(c:Collector,config:Record<string,string>,readOnly=false){
 const api=tiktokWriteApi(config);
 if(readOnly){
  const shape={advertiserId:id,level:z.enum(['campaign','adgroup','ad']).describe('Entity level to inspect.'),entityId:id,smartPlus:z.boolean().optional().describe('Use the dedicated upgraded Smart+ endpoints rather than classic endpoints.')};
  c.tool('tiktok_get_write_context','Read the exact TikTok entity, parent settings and advertiser currency/timezone before editing or building a new configuration. Read-only.',shape,async raw=>{
   try{const a=z.object(shape).strict().parse(raw);const account=await api.info(a.advertiserId);const entity=await api.entity(a.advertiserId,a.level,a.entityId,a.smartPlus);const parents:Row={};
    if(entity.campaign_id&&a.level!=='campaign')parents.campaign=await api.entity(a.advertiserId,'campaign',String(entity.campaign_id),a.smartPlus);
    if(entity.adgroup_id&&a.level==='ad')parents.adgroup=await api.entity(a.advertiserId,'adgroup',String(entity.adgroup_id),a.smartPlus);
    return output({environment:api.environment,account,entity,parents,note:'Money is in account currency, not cents. Schedule timestamps are UTC; weekly dayparting uses advertiser timezone. Supplied arrays replace the corresponding settings.'});
   }catch(e){return output({error:(e as Error).message},true);}
  });return;
 }
 type Plan={path:string,payload:Row,file?:{field:string,name:string,bytes:Uint8Array,mime:string},scope?:()=>Promise<void>,verify?:(data:Row)=>Promise<unknown>};
 function register(name:string,description:string,shape:ToolShape,build:(a:Row)=>Plan){
  const schema=z.object({advertiserId:id,...shape,...modes}).strict();
  c.tool(name,description+' Local preview by default. No automatic retry; advertiser ownership is checked before applying.',schema.shape,async raw=>{
   try{const a:Row=schema.parse(raw);api.scope(a.advertiserId);const p=build(a);
    if(!a.confirm)return output({applied:false,action:name,environment:api.environment,payload:{advertiser_id:a.advertiserId,...p.payload},validation:{local:true,tiktok:false,ownershipChecked:false},nextAction:'Review exact parameters, then repeat with confirm:true. TikTok has not validated this preview.'});
    const account=await api.info(a.advertiserId);if(a.currency&&account.currency!==a.currency)throw new Error(`Advertiser currency is ${account.currency}, not ${a.currency}. Nothing was changed.`);
    await p.scope?.();const result=await api.call(p.path,'POST',{advertiser_id:a.advertiserId,...p.payload},p.file);
    let verification;try{if(p.verify)verification=await p.verify(result.data);}catch{verification={confirmed:false,message:'Write acknowledged, but readback failed. Reconcile the returned IDs; do not recreate.'};}
    return output({applied:true,action:name,environment:api.environment,result:result.data,requestId:result.request_id,verification});
   }catch(error){const e=error as Error&{code?:number,requestId?:string,outcome?:string};return output({error:e.message,code:e.code,requestId:e.requestId,outcome:e.outcome||'not_applied',retrySafe:false},true);}
  });
 }
 for(const smart of [false,true])for(const level of ['campaign','adgroup','ad'] as const)for(const create of [true,false]){
  const cap=level==='adgroup'?'Adgroup':level==='campaign'?'Campaign':'Ad';
  const model=`${smart?'SmartPlus':''}${cap}${create?'Create':'Update'}Body`;
  const name=smart?`tiktok_${create?'create':'update'}_smart_plus_${level}`:level==='campaign'?`tiktok_${create?'create_campaign_advanced':'update_campaign_configuration'}`:level==='adgroup'?`tiktok_${create?'create_adgroup':'update_adgroup_configuration'}`:`tiktok_${create?'create_ads':'update_ads'}`;
  const configSchema=modelSchema(model);
  register(name,`${create?'Create DISABLED':'Update'} ${smart?'upgraded Smart+':'classic'} TikTok ${level==='ad'?'ads (video, image, carousel or authorized Spark content)':level}. ${create?'No option to launch active.':'Status is unchanged.'} Native objective/format eligibility is enforced by TikTok.`,{configuration:configSchema.describe('Native TikTok settings. Use tiktok_get_write_context before edits. Advertiser and status fields are controlled separately. Read the schema rather than guessing parameters.'),currency},a=>{
   const p:Row=structuredClone(a.configuration);
   if(smart&&create&&level==='campaign'){
    if(p.objective_type==='WEB_CONVERSIONS'&&!['WEBSITE','APP','WEB_AND_APP'].includes(p.sales_destination))throw new Error('Smart+ WEB_CONVERSIONS requires sales_destination: WEBSITE, APP or WEB_AND_APP.');
    if(p.objective_type==='APP_PROMOTION'&&!['APP_INSTALL','APP_RETARGETING','MINIS'].includes(p.app_promotion_type))throw new Error('Smart+ APP_PROMOTION requires app_promotion_type.');
    p.budget_optimize_on??=true;
    p.budget_mode??=p.budget_optimize_on?'BUDGET_MODE_DYNAMIC_DAILY_BUDGET':'BUDGET_MODE_INFINITE';
    if(p.is_search_campaign&&p.budget_optimize_on)throw new Error('Upgraded Smart+ Search requires budget_optimize_on:false and TikTok allowlisting.');
    const allowed=p.budget_optimize_on?['BUDGET_MODE_DYNAMIC_DAILY_BUDGET','BUDGET_MODE_TOTAL']:['BUDGET_MODE_INFINITE','BUDGET_MODE_DAY','BUDGET_MODE_TOTAL'];
    if(!allowed.includes(p.budget_mode))throw new Error('Budget mode is incompatible with the Smart+ CBO setting.');
    if(p.budget_mode!=='BUDGET_MODE_INFINITE'&&!(p.budget>0))throw new Error('An explicit positive Smart+ budget is required for this budget mode.');
   }
   validateSettings(p,a,create,level);
   if(create){if(level==='ad'&&!smart)p.creatives=p.creatives.map((x:Row)=>({...x,operation_status:'DISABLE'}));else p.operation_status='DISABLE';}
   if(!create&&level==='ad'&&!smart)p.patch_update=true;
   const nativeId=level==='campaign'?p.campaign_id:level==='adgroup'?p.adgroup_id:smart?p.smart_plus_ad_id:p.ad_id;
   return {path:`${smart?'smart_plus/':''}${level}/${create?'create':'update'}/`,payload:p,scope:async()=>{
    if(p.campaign_id){const parent=await api.entity(a.advertiserId,'campaign',p.campaign_id,smart);if(level==='adgroup'){
     if(p.budget_mode&&parent.budget_mode==='BUDGET_MODE_DAY'&&p.budget_mode==='BUDGET_MODE_TOTAL')throw new Error('A daily-budget campaign requires daily-budget ad groups.');
     if(parent.budget_optimize_on&&Number(p.budget)>0)throw new Error('Campaign budget optimization is enabled; omit the ad group budget.');
     if(create&&!parent.budget_optimize_on&&!(Number(p.budget)>0))throw new Error('An ad group budget is required when the campaign does not own its budget.');
    }}
    if(p.adgroup_id){const group=await api.entity(a.advertiserId,'adgroup',p.adgroup_id,smart);
     if(!create&&level==='adgroup'){
      if(p.budget!==undefined){const parent=await api.entity(a.advertiserId,'campaign',String(group.campaign_id),smart);if(parent.budget_optimize_on)throw new Error('Campaign budget optimization is enabled; edit the campaign budget instead.');}
      const merged={...group,...p};if(merged.schedule_start_time&&merged.schedule_end_time&&merged.schedule_end_time<=merged.schedule_start_time)throw new Error('Resulting end time must follow the existing start time.');}
    }
    if(!create&&level==='ad')for(const adId of smart?[p.smart_plus_ad_id]:(p.creatives||[]).map((x:Row)=>x.ad_id)){
     if(!adId)throw new Error('Every updated creative needs its ad_id.');const ad=await api.entity(a.advertiserId,'ad',adId,smart);if(p.adgroup_id&&String(ad.adgroup_id)!==p.adgroup_id)throw new Error('Ad does not belong to the declared ad group.');
    }
   },verify:async(data:Row)=>{
    const ids=create?(level==='ad'&&!smart?data.ad_ids:[data[`${smart&&level==='ad'?'smart_plus_ad':level}_id`]]):(nativeId?[nativeId]:(p.creatives||[]).map((x:Row)=>x.ad_id));
    if(!ids?.length||ids.some((v:unknown)=>!v))return {confirmed:false,message:'No readable object ID returned. Reconcile the advertiser before retrying.'};
    const entities:Row[]=[];for(const entityId of ids.slice(0,10))entities.push(await api.entity(a.advertiserId,level,String(entityId),smart));
    return {confirmed:ids.length===entities.length&&(!create||entities.every(x=>x.operation_status==='DISABLE')),checked:entities.length,total:ids.length,entities};
   }};
  });
 }
 for(const smart of [false,true])for(const level of ['campaign','adgroup','ad'] as const){
  if(!smart&&level!=='ad')continue;
  register(`tiktok_update_${smart?'smart_plus_':''}${level}_status`,`Pause or reactivate exactly one ${smart?'Smart+':'classic'} ${level}.`,{entityId:id,status:z.enum(['ENABLE','DISABLE']).describe('ENABLE reactivates; DISABLE pauses. No deletion.')},a=>({path:`${smart?'smart_plus/':''}${level}/status/update/`,payload:{[`${smart&&level==='ad'?'smart_plus_ad':level}_ids`]:[a.entityId],operation_status:a.status},scope:async()=>{await api.entity(a.advertiserId,level,a.entityId,smart);},verify:()=>api.entity(a.advertiserId,level,a.entityId,smart)}));
 }
 register('tiktok_update_smart_plus_material_status','Pause or reactivate selected creative materials inside one upgraded Smart+ ad. Parent campaign, ad group and ad statuses are unchanged; the shared library asset is not modified.',{
  smartPlusAdId:id.describe('The parent smart_plus_ad_id, not the generated creative/ad ID.'),
  materialIds:z.array(id).min(1).max(20).refine(v=>new Set(v).size===v.length,'Material IDs must be unique.').describe('Exact ad_material_ids from this ad creative_list; never video_id, image ID or smart_plus_creative_id.'),
  status:z.enum(['ENABLE','DISABLE']).describe('ENABLE enables these materials only; it does not activate paused parents. DISABLE pauses them.')
 },a=>({
  path:'smart_plus/ad/material_status/update/',payload:{smart_plus_ad_id:a.smartPlusAdId,ad_material_ids:a.materialIds,operation_status:a.status},
  scope:async()=>{const ad=await api.entity(a.advertiserId,'ad',a.smartPlusAdId,true);const own=new Set((ad.creative_list||[]).map((x:Row)=>String(x.ad_material_id)));if(a.materialIds.some((v:string)=>!own.has(v)))throw new Error('Every material must belong to the selected Smart+ ad. Nothing was changed.');},
  verify:async()=>{const ad=await api.entity(a.advertiserId,'ad',a.smartPlusAdId,true);const materials=(ad.creative_list||[]).filter((x:Row)=>a.materialIds.includes(String(x.ad_material_id)));return {confirmed:materials.length===a.materialIds.length&&materials.every((x:Row)=>x.material_operation_status===a.status),checked:materials.length,total:a.materialIds.length,smartPlusAdId:a.smartPlusAdId,parentAdStatus:ad.operation_status,materials:materials.map((x:Row)=>({ad_material_id:x.ad_material_id,material_operation_status:x.material_operation_status}))};}
 }));
 for(const level of ['campaign','adgroup','ad'] as const)register(`tiktok_rename_${level}`,`Rename one classic TikTok ${level}. Does not change its budget, creative content or status.`,{entityId:id,name:z.string().trim().min(1).max(100).describe('Exact new business name.')},a=>{
  const p:Row=level==='ad'?{creatives:[{ad_id:a.entityId,ad_name:a.name}],patch_update:true}:{[`${level}_id`]:a.entityId,[`${level}_name`]:a.name};
  return {path:`${level}/update/`,payload:p,scope:async()=>{const current=await api.entity(a.advertiserId,level,a.entityId);if(level==='ad')p.adgroup_id=String(current.adgroup_id);},verify:()=>api.entity(a.advertiserId,level,a.entityId)};
 });
 for(const kind of ['image','video'])register(`tiktok_upload_ad_${kind}`,`Import a ${kind} from a public HTTPS media URL or base64 file (up to 5 MiB). TikTok may process it asynchronously; acceptance is not proof the media is ready.`,{
  fileUrl:z.string().url().startsWith('https://').optional().describe('Public URL of the actual media file, not a landing page. Mutually exclusive with bytesBase64.'),
  bytesBase64:z.string().min(4).max(7_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/).optional().describe('Base64 media bytes without a data-URL prefix. Maximum decoded 5 MiB. The required file checksum is calculated automatically; bytes never appear in previews.'),
  fileName:z.string().min(1).max(100).describe('Uploaded filename including extension. This is not an ad name.'),
 },a=>{
  if(Number(!!a.fileUrl)+Number(!!a.bytesBase64)!==1)throw new Error('Supply exactly one of fileUrl or bytesBase64.');
  if(a.fileUrl)return {path:`file/${kind}/ad/upload/`,payload:{upload_type:'UPLOAD_BY_URL',file_name:a.fileName,[`${kind}_url`]:a.fileUrl}};
  let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(a.bytesBase64),c=>c.charCodeAt(0));}catch{throw new Error('Invalid base64 file.');}
  if(bytes.length>5*1024*1024)throw new Error('File exceeds 5 MiB. Use a public media URL for larger files.');
  const signature=createHash('md5').update(bytes).digest('hex');
  return {path:`file/${kind}/ad/upload/`,payload:{upload_type:'UPLOAD_BY_FILE',file_name:a.fileName,[`${kind}_signature`]:signature},file:{field:`${kind}_file`,name:a.fileName,bytes,mime:kind==='video'?'video/mp4':a.fileName.toLowerCase().endsWith('.png')?'image/png':'image/jpeg'}};
 });
}
