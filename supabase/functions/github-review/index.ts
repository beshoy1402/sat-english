import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const respond=(body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const ghHeaders=(token:string)=>({"Authorization":"Bearer "+token,"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return respond({error:"Method not allowed"},405);
 const url=Deno.env.get("SUPABASE_URL"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),auth=req.headers.get("Authorization");
 if(!url||!serviceKey||!auth)return respond({error:"Server configuration or authorization missing"},500);
 const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
 const token=auth.replace(/^Bearer\s+/i,"");
 const {data:userData,error:userError}=await admin.auth.getUser(token);
 if(userError||!userData.user)return respond({error:"Sign in again to continue."},401);
 const {data:profile}=await admin.from("profiles").select("role,is_active").eq("id",userData.user.id).single();
 if(!profile?.is_active||profile.role!=="developer")return respond({error:"Developer role required."},403);
 let body:any;try{body=await req.json();}catch{return respond({error:"Invalid request."},400);}
 const action=String(body.action||"list");
 const {data:config,error:configError}=await admin.rpc("github_integration_get");
 if(configError||!config?.length||!config[0].key_configured)return respond({error:"GitHub is not connected. Save a fine-grained GitHub token in Developer → GitHub integration first."},503);
 const {data:secret,error:secretError}=await admin.rpc("github_integration_read_secret");
 if(secretError||!secret)return respond({error:"GitHub credential is unavailable."},503);
 const owner=config[0].repo_owner,repo=config[0].repo_name;
 const base="https://api.github.com/repos/"+encodeURIComponent(owner)+"/"+encodeURIComponent(repo);
 try{
  if(action==="check"){
   const r=await fetch("https://api.github.com/user",{headers:ghHeaders(secret)});
   const data=await r.json();if(!r.ok)return respond({error:"GitHub authentication failed: "+(data.message||r.status)},502);
   const repoCheck=await fetch(base,{headers:ghHeaders(secret)});const repoData=await repoCheck.json();
   if(!repoCheck.ok)return respond({error:"Token cannot access "+owner+"/"+repo+": "+(repoData.message||repoCheck.status)},502);
   return respond({connected:true,login:data.login,repository:repoData.full_name,permissions:repoData.permissions??{}});
  }
  if(action==="list"){
   const r=await fetch(base+"/pulls?state=open&per_page=50&sort=updated&direction=desc",{headers:ghHeaders(secret)});
   const data=await r.json();if(!r.ok)return respond({error:"GitHub pull request request failed: "+(data.message||r.status)},502);
   return respond({pull_requests:(data as any[]).map(p=>({number:p.number,title:p.title,body:p.body,html_url:p.html_url,state:p.state,draft:p.draft,user:p.user?.login,created_at:p.created_at,updated_at:p.updated_at,head:p.head?.ref,base:p.base?.ref,labels:(p.labels??[]).map((l:any)=>l.name)})),repository:owner+"/"+repo});
  }
  const number=Number(body.pull_number);
  if(!Number.isInteger(number)||number<1)return respond({error:"A valid pull request number is required."},400);
  if(action==="files"){
   const r=await fetch(base+"/pulls/"+number+"/files?per_page=100",{headers:ghHeaders(secret)});
   const data=await r.json();if(!r.ok)return respond({error:"Could not load pull request files: "+(data.message||r.status)},502);
   return respond({files:(data as any[]).map(f=>({filename:f.filename,status:f.status,additions:f.additions,deletions:f.deletions,changes:f.changes,patch:f.patch??null,blob_url:f.blob_url}))});
  }
  if(action==="review"){
   const event=String(body.event||"");
   if(!["APPROVE","REQUEST_CHANGES","COMMENT"].includes(event))return respond({error:"Unsupported review action."},400);
   const reviewBody=String(body.body||"").slice(0,6000);
   if(event!=="APPROVE"&&!reviewBody.trim())return respond({error:"Add a review comment for this action."},400);
   const r=await fetch(base+"/pulls/"+number+"/reviews",{method:"POST",headers:ghHeaders(secret),body:JSON.stringify({event,body:reviewBody})});
   const data=await r.json();if(!r.ok)return respond({error:"GitHub could not submit the review: "+(data.message||r.status)},502);
   return respond({success:true,review:{id:data.id,state:data.state,html_url:data.html_url,submitted_at:data.submitted_at}});
  }
  return respond({error:"Unsupported GitHub action."},400);
 }catch(error){return respond({error:error instanceof Error?error.message:"GitHub request failed."},502);}
});
