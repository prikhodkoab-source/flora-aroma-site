import {createHash,createPublicKey,verify} from "node:crypto";
import {existsSync,lstatSync,readFileSync,readdirSync,realpathSync} from "node:fs";
import {join,resolve} from "node:path";
import {publicationMediaManifestHash} from "../src/lib/publication-policy.mjs";

const fail = message=>{throw new Error(message)};
const sha = b=>createHash("sha256").update(b).digest("hex");
function regular(path) {
  if(lstatSync(path).isSymbolicLink()||!lstatSync(path).isFile()||realpathSync(path)!==resolve(path))
    fail("Indirect editorial release file");
  return readFileSync(path);
}
export function readSiteReceipts(site) {
  const dir=join(site,"content/editorial-releases"), result=new Map();
  if(!existsSync(dir)){
    if(existsSync(join(site,"config/editorial-release-allowlist.json")))fail("Missing enrolled release directory");
    return result;
  }
  if(realpathSync(dir)!==resolve(dir))fail("Indirect editorial release directory");
  const allowed=JSON.parse(regular(join(site,"config/editorial-release-allowlist.json")));
  if(!Array.isArray(allowed)||allowed.some(h=>!/^([0-9a-f]{64})$/.test(h))||new Set(allowed).size!==allowed.length)
    fail("Invalid editorial release allowlist");
  const receipts=new Set();
  for(const name of readdirSync(dir)){
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(name))fail("Invalid editorial release name");
    const slug=name.slice(0,-5), envelope=JSON.parse(regular(join(dir,name)));
    const raw=Buffer.from(envelope.payload,"base64"),sig=Buffer.from(envelope.signature,"base64");
    const key=createPublicKey(regular(join(site,"config/editorial-release-public.pem")));
    if(raw.length>128000||sig.length!==64||key.asymmetricKeyType!=="ed25519"||!verify(null,raw,key,sig))
      fail("Unsigned or invalid editorial release");
    const fingerprint=sha(raw);
    if(!allowed.includes(fingerprint)||receipts.has(fingerprint))fail("Editorial release not enrolled");
    receipts.add(fingerprint);
    const proof=JSON.parse(raw);
    if(proof.schema!=="editorial-site-release-v1"||proof.channel!=="site_blog"||proof.slug!==slug||
       !/^WC-ED-[A-Z0-9-]+$/.test(proof.cid)||!/^([0-9a-f]{16})$/.test(proof.revision)||
       ![proof.snapshot,proof.preview,proof.source].every(v=>/^[0-9a-f]{64}$/.test(v))||result.has(proof.cid))
      fail("Invalid editorial site approval");
    const text=regular(join(site,"src/content/publications",slug+".md")).toString("utf8").replace(/\r\n/g,"\n");
    if(sha(text)!==proof.source)fail("Changed signed article");
    const m=/^---\n([\s\S]*?)\n---\n/.exec(text),data=m&&JSON.parse(m[1]);
    if(!data||data.publicationId!==proof.cid||data.slug!==slug||data.draftRevision!==proof.revision||
       data.approvedRevision!==proof.revision||data.approvedPreviewHash!==proof.preview||
       data.publicationStatus!=="approved"||data.editorialOrigin!=="trend_radar"||
       !Array.isArray(data.articleMedia)||data.articleMedia.length!==proof.photos.length||
       !data.articleMedia.every((i,k)=>i.src===proof.photos[k].src&&i.checksum===proof.photos[k].checksum&&
          i.placement===proof.photos[k].role&&["cover","body"].includes(i.placement)))
      fail("Changed signed media selection");
    for(const im of proof.photos){
      if(!im.src.startsWith("/images/publications/"+slug+"/")||
         !/^\/images\/publications\/[a-z0-9-]+\/[a-z0-9-]+\.jpg$/.test(im.src)||
         sha(regular(join(site,"public",im.src.slice(1))))!==im.checksum)fail("Changed signed photograph");
    }
    result.set(proof.cid,{revision:proof.revision,slug});
  }
  if(receipts.size!==allowed.length)fail("Enrolled editorial release not found");
  return result;
}

// Called in a clean storefront checkout. Never approve an asset or write a file here.
export function publicSource(draft, expected, publishedAt){
  const m=/^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(draft);
  const d=m&&JSON.parse(m[1]);
  if(!d||d.publicationId!==expected.cid||d.draftRevision!==expected.revision||d.editorialOrigin!=="trend_radar"||
     d.publicationStatus!=="draft"||d.mediaManifestHash!==expected.manifest)fail("Wrong staged source");
  d.articleMedia=d.articleMedia.filter(i=>i.placement!=="social").map(i=>({...i,approvalStatus:"approved"}));
  if(!d.articleMedia.every((i,k)=>i.src===expected.photos[k]?.src&&i.checksum===expected.photos[k]?.checksum)||
     d.articleMedia.length!==expected.photos.length)fail("Only reviewed article photographs are releasable");
  Object.assign(d,{publicationStatus:"approved",mediaRightsStatus:"approved",mediaApprovalStatus:"approved",
    mediaGateStatus:"approved_for_publication",approvedRevision:expected.revision,approvedPreviewHash:expected.preview,publishedAt});
  d.approvedMediaManifestHash=d.mediaManifestHash=publicationMediaManifestHash({data:d});
  return "---\n"+JSON.stringify(d)+"\n---\n"+m[2];
}
