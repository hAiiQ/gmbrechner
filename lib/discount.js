export function readDiscountPercent(value,fail){
  const percent=value===undefined?0:value;
  if(typeof percent!=='number'||!Number.isFinite(percent)||percent<0||percent>100||Math.round(percent*100)/100!==percent){
    fail(400,'Bitte einen Rabatt von 0 bis 100 % mit höchstens zwei Nachkommastellen eingeben.');
  }
  return Math.round(percent*100);
}

export function calculateDiscount(lines,basisPoints){
  const subtotal=lines.reduce((sum,line)=>sum+line.price_cents*line.quantity,0);
  const discount=Math.round(subtotal*basisPoints/10000);
  const portions=lines.map((line,index)=>{
    const scaled=line.price_cents*line.quantity*basisPoints;
    return {index,id:line.id,cents:Math.floor(scaled/10000),remainder:scaled%10000};
  });
  // Allocate rounding cents to the largest fractional amounts, with a stable
  // product-ID tie-break. Item revenues then add up exactly to the receipt.
  let remaining=discount-portions.reduce((sum,portion)=>sum+portion.cents,0);
  for(const portion of [...portions].sort((a,b)=>b.remainder-a.remainder||a.id.localeCompare(b.id))){
    if(remaining===0)break;
    portion.cents++;remaining--;
  }
  return {subtotal_cents:subtotal,discount_cents:discount,total_cents:subtotal-discount,line_discounts:portions.map(portion=>portion.cents)};
}
