import {scrypt,scryptSync,createHash,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
// The agreed bar password is stored as a salted verifier, never in the browser.
const SALT='b817b4c4a066eb108385de3fefc25ce3bf418dbffe09d795';
const DEFAULT_VERIFIER='156840d9c7059b74873a145bf9dccebbbfac17b547b5665caa55bc2d3211d06e';
export function barAccess(password) {
  const expected=password?scryptSync(password,SALT,32):Buffer.from(DEFAULT_VERIFIER,'hex');
  const version=createHash('sha256').update(expected).digest('hex');
  return {version,async verify(value){
    if(typeof value!=='string'||value.length<1||value.length>256)return false;
    const actual=await derive(value,SALT,32);
    return timingSafeEqual(actual,expected);
  }};
}
