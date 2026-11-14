const loopback=new Set(['127.0.0.1','::1','::ffff:127.0.0.1']);
const proxyHeaders=['forwarded','x-forwarded-for','x-forwarded-host','x-forwarded-proto','x-real-ip','via'];

/** Technical HTTP authentication boundary, never a spending authorization.
 * The caller supplies the actual Node socket; HTTP headers cannot assert it.
 * No browser secret, cookie, query token or localStorage credential is needed.
 */
export function isDirectLocalOwner(req,{enabled=true}={}){
 if(!enabled||!loopback.has(req.socket?.remoteAddress)||proxyHeaders.some(k=>req.headers[k]!==undefined))return false;
 const port=req.socket.localPort,host=req.headers.host;
 if(!Number.isSafeInteger(port)||typeof host!=='string')return false;
 let url;try{url=new URL(`http://${host}`);}catch{return false;}
 if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||Number(url.port||80)!==port||url.username||url.password||url.pathname!=='/'||url.search||url.hash)return false;
 // Reject DNS-rebinding, browser cross-site requests and embedded-resource reads.
 const origin=req.headers.origin;
 if(origin!==undefined&&origin!==url.origin)return false;
 const site=req.headers['sec-fetch-site'];
 if(site!==undefined&&!['same-origin','none'].includes(site))return false;
 const destination=req.headers['sec-fetch-dest'];
 if(destination!==undefined&&!['empty','document'].includes(destination))return false;
 return true;
}
