import crypto from "node:crypto";

export function safeEqualHex(leftValue, rightValue) {
  try {
    const left=Buffer.from(String(leftValue || "").trim().toLowerCase(),"hex");
    const right=Buffer.from(String(rightValue || "").trim().toLowerCase(),"hex");
    return left.length>0 && left.length===right.length && crypto.timingSafeEqual(left,right);
  } catch {
    return false;
  }
}

export function wipayResponseHash(transactionId, total, apiKey) {
  return crypto.createHash("md5").update(String(transactionId) + String(total) + String(apiKey)).digest("hex");
}

export function verifyWipayResponse({transactionId,total,apiKey,hash}) {
  if(!transactionId || !total || !apiKey || !hash) return false;
  return safeEqualHex(wipayResponseHash(transactionId,total,apiKey),hash);
}

function daysInUtcMonth(year,month) {
  return new Date(Date.UTC(year,month+1,0)).getUTCDate();
}

export function addBillingPeriod(baseValue, cycle) {
  const base=new Date(baseValue);
  if(!Number.isFinite(base.getTime())) throw new Error("Invalid billing period start.");
  const result=new Date(base.getTime());
  const day=result.getUTCDate();
  result.setUTCDate(1);
  if(cycle==="monthly") {
    result.setUTCMonth(result.getUTCMonth()+1);
  } else if(cycle==="annual") {
    result.setUTCFullYear(result.getUTCFullYear()+1);
  } else {
    throw new Error("Unsupported billing cycle.");
  }
  result.setUTCDate(Math.min(day,daysInUtcMonth(result.getUTCFullYear(),result.getUTCMonth())));
  return result;
}

export function normalizeMoney(value) {
  const number=Number(value);
  if(!Number.isFinite(number) || number<0) return null;
  return Math.round(number*100)/100;
}
