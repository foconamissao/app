export function clampLevel(v, fallback=3){
  const n=Number(v);
  return Number.isFinite(n)?Math.min(5,Math.max(1,n)):fallback;
}

export function priorityScore(item, maxPeso=1){
  const peso=Math.max(.1,Number(item?.disciplinas?.peso ?? item?.peso_disciplina ?? 1));
  const pesoNorm=Math.min(5,(peso/Math.max(.1,maxPeso))*5);
  const rQuest=clampLevel(item?.recorrencia);
  const rAss=clampLevel(item?.assuntos?.recorrencia,rQuest);
  const dQuest=clampLevel(item?.dificuldade);
  const dAss=clampLevel(item?.assuntos?.dificuldade,dQuest);
  const recorrencia=(rQuest*.6)+(rAss*.4);
  const dificuldade=(dQuest*.6)+(dAss*.4);
  return Number(((pesoNorm*.40)+(recorrencia*.35)+(dificuldade*.25)).toFixed(2));
}

export function weightedSample(items, count, getWeight){
  return items.map(item=>{
    const weight=Math.max(.05,Number(getWeight(item))||.05);
    return {item,key:-Math.log(Math.max(Number.EPSILON,Math.random()))/weight};
  }).sort((a,b)=>a.key-b.key).slice(0,count).map(x=>x.item);
}

export function priorityLabel(score){
  if(score>=4.15)return 'Prioridade muito alta';
  if(score>=3.35)return 'Prioridade alta';
  if(score>=2.55)return 'Prioridade média';
  return 'Prioridade baixa';
}
