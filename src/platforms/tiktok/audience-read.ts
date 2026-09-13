/** Copyright 2026 GetMCPAds. SPDX-License-Identifier: Apache-2.0 */
import {z} from 'zod';
import type {TikTokClient} from './client.js';
import {getMetricDefinition} from './metric-catalog.js';

const id=z.string().regex(/^\d+$/).describe('Exact TikTok numeric ID, as a string.');
const ids=z.array(id).min(1).max(100);
export const adgroupReadShape={
 advertiserId:id,
 campaignId:id.optional(),
 adgroupIds:ids.optional(),
 smartPlus:z.boolean().optional().default(false).describe('Use true for upgraded Smart+ ad groups: reads their native targeting_spec and exact placements via smart_plus/adgroup/get. No fallback to classic settings.'),
 page:z.number().int().min(1).max(10000).optional().default(1),
 limit:z.number().int().min(1).max(1000).optional().default(100),
};
function adgroupSchema(){return z.object(adgroupReadShape).strict();}
type Row=Record<string,any>;
const endpoint=(path:string,params:Row)=>{
 const search=new URLSearchParams();
 for(const[k,v]of Object.entries(params))if(v!==undefined)search.set(k,typeof v==='object'?JSON.stringify(v):String(v));
 return `/${path}/?${search}`;
};
export const TARGETING_FIELDS=['audience_ids','excluded_audience_ids','location_ids','zipcode_ids','languages','age_groups','gender','interest_category_ids','interest_keyword_ids','actions','behavior_category_ids','operating_systems','device_model_ids','device_price_ranges','network_types','spending_power','smart_audience_enabled','smart_interest_behavior_enabled','targeting_optimization_mode','suggestion_audience_enabled','placement_type','placements','tiktok_subplacements','search_result_enabled'] as const;
export function targetingSettings(row:Row){
 const nested=row.targeting_spec && typeof row.targeting_spec==='object' ? row.targeting_spec : {};
 const settings:Row={}; const notReturned:string[]=[];
 for(const field of TARGETING_FIELDS){
  if(Object.hasOwn(nested,field))settings[field]=nested[field];
  else if(Object.hasOwn(row,field))settings[field]=row[field];
  else notReturned.push(field);
 }
 return {settings,notReturned};
}
export async function readAdgroups(client:TikTokClient,raw:unknown){
 const a=adgroupSchema().parse(raw);
 const path=`${a.smartPlus?'smart_plus/':''}adgroup/get`;
 // Omit fields: the previous projection dropped targeting. Smart+ has its own
 // complete native response, including targeting_spec and root placements.
 const result=await client.fetchUrl(endpoint(path,{advertiser_id:a.advertiserId,page:a.page,page_size:a.limit,filtering:{primary_status:'STATUS_ALL',...(a.campaignId?{campaign_ids:[a.campaignId]}:{}),...(a.adgroupIds?{adgroup_ids:a.adgroupIds}:{})}})) as Row;
 const rows:Row[]=result.data?.list??[];
 if(a.adgroupIds&&rows.some(row=>!a.adgroupIds!.includes(String(row.adgroup_id))))throw new Error('TikTok returned an ad group outside the requested filter.');
 if(a.campaignId&&rows.some(row=>String(row.campaign_id)!==a.campaignId))throw new Error('TikTok returned an ad group outside the requested campaign.');
 const totalPages=Number(result.data?.page_info?.total_page);
 return {...result,endpoint:`/${path}/`,smartPlus:a.smartPlus,
  pagination:{page:a.page,pageSize:a.limit,nextPage:Number.isFinite(totalPages)?a.page<totalPages?a.page+1:null:rows.length===a.limit?a.page+1:null},
  targetingCoverage:rows.map(row=>({adgroup_id:row.adgroup_id,...targetingSettings(row)})),
  limitations:['Configured targeting is not the audience actually reached. Missing/null fields are unknown or not applicable, not proof of no targeting. Smart+ automatic expansion cannot be inferred from an absent field.'],
  nextActions:['Use tiktok_get_audiences for custom/lookalike audience names and types; library presence alone does not mean an audience is targeted. Use tiktok_get_targeting_catalog to resolve native IDs. Use tiktok_get_audience_report for delivered age/gender performance.']};
}

export const AUDIENCE_BREAKDOWNS=['age','gender'] as const;
const levels=['AUCTION_ADVERTISER','AUCTION_CAMPAIGN','AUCTION_ADGROUP','AUCTION_AD'] as const;
const levelId:Record<string,string>={AUCTION_ADVERTISER:'advertiser_id',AUCTION_CAMPAIGN:'campaign_id',AUCTION_ADGROUP:'adgroup_id',AUCTION_AD:'ad_id'};
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;},'Use a real date YYYY-MM-DD.');
export const audienceReportShape={
 advertiserId:id,
 dataLevel:z.enum(levels).optional().default('AUCTION_CAMPAIGN'),
 dimensions:z.array(z.string()).min(1).max(4).describe('age and/or gender, optionally with the ID matching dataLevel. Multiple demographics return separate reports, never a fabricated age × gender cross-tab.'),
 metrics:z.array(z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/)).min(1).max(100).describe('Native AUDIENCE metric keys, e.g. spend, impressions, clicks, ctr, cpc, conversion. Provider rejects unsupported metric combinations; BASIC metric availability does not imply AUDIENCE support.'),
 startDate:date,endDate:date,
 campaignIds:ids.optional(),adgroupIds:ids.optional(),adIds:ids.optional(),
 page:z.number().int().min(1).max(10000).optional().default(1),
 limit:z.number().int().min(1).max(1000).optional().default(500),
 orderField:z.enum(['spend','impressions','clicks']).optional(),orderType:z.enum(['ASC','DESC']).optional(),
};
export function planAudienceReport(raw:unknown){
 const a=z.object(audienceReportShape).strict().parse(raw);
 if(a.startDate>a.endDate)throw new Error('startDate must be on or before endDate.');
 const expectedId=levelId[a.dataLevel];
 const dimensions=[...new Set(a.dimensions)];
 const breakdowns=dimensions.filter(d=>(AUDIENCE_BREAKDOWNS as readonly string[]).includes(d));
 if(!breakdowns.length||dimensions.some(d=>d!==expectedId&&!(AUDIENCE_BREAKDOWNS as readonly string[]).includes(d)))throw new Error(`AUDIENCE supports age/gender with ${expectedId} at ${a.dataLevel}. Use tiktok_get_report_raw for other native combinations.`);
 if(a.adIds&&a.dataLevel!=='AUCTION_AD')throw new Error('adIds requires AUCTION_AD.');
 if(a.adgroupIds&&!['AUCTION_ADGROUP','AUCTION_AD'].includes(a.dataLevel))throw new Error('adgroupIds requires AUCTION_ADGROUP or AUCTION_AD.');
 const metrics=[...new Set(a.metrics.map(key=>{const m=getMetricDefinition(key);if(m?.type==='calculated')throw new Error(`Calculated metric ${key} is not supported in AUDIENCE. Request its native components instead.`);return m?.apiField??key;}))];
 if(a.orderField&&!metrics.includes(a.orderField))throw new Error('Include orderField in metrics.');
 if(a.orderType&&!a.orderField)throw new Error('orderType requires orderField.');
 const filtering=[['campaign_ids',a.campaignIds],['adgroup_ids',a.adgroupIds],['ad_ids',a.adIds]].filter(([,value])=>value).map(([field_name,value])=>({field_name,filter_type:'IN',filter_value:JSON.stringify(value)}));
 return {a,expectedId,breakdowns,metrics,filtering};
}
export async function readAudienceReport(client:TikTokClient,raw:unknown){
 const {a,expectedId,breakdowns,metrics,filtering}=planAudienceReport(raw);
 const reports=[];
 for(const breakdown of breakdowns){
  const dims=[expectedId,breakdown];
  const params={advertiser_id:a.advertiserId,service_type:'AUCTION',report_type:'AUDIENCE',data_level:a.dataLevel,dimensions:dims,metrics,start_date:a.startDate,end_date:a.endDate,page:a.page,page_size:a.limit,...(filtering.length?{filtering}:{}),order_field:a.orderField,order_type:a.orderField?(a.orderType??'DESC'):undefined};
  const native=await client.fetchUrl(endpoint('report/integrated/get',params)) as Row;
  const data=native.data?.list??[];
  const totalPages=Number(native.data?.page_info?.total_page);
  reports.push({breakdown,dimensions:dims,data,rowCount:data.length,pageInfo:native.data?.page_info??null,nextPage:Number.isFinite(totalPages)?a.page<totalPages?a.page+1:null:data.length===a.limit?a.page+1:null,requestId:native.request_id});
 }
 return {reportType:'AUDIENCE',dataLevel:a.dataLevel,advertiserId:a.advertiserId,startDate:a.startDate,endDate:a.endDate,metrics,reports,
  ...(reports.length===1?{data:reports[0].data,rowCount:reports[0].rowCount,nextPage:reports[0].nextPage}:{}),
  limitations:['These are delivered audience breakdowns, not configured targeting, Custom Audience membership or causal evidence about Smart+ signals.','Age and gender reports are separate marginal distributions. Never join them into a cross-tab or sum spend across breakdowns.','Only the requested page is returned. Follow nextPage; do not treat a partial page as account totals. Empty results are not evidence of zero targeting.'],
  debug:{source:'tiktok_ads',apiVersion:'v1.3',requestCount:reports.length}};
}
