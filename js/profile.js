import{sb}from'./supabase.js';
import{avatarUrl}from'./auth.js';

const $=s=>document.querySelector(s);
let pendingBlob=null;
let img=new Image();
let scale=1,baseScale=1,offX=0,offY=0,drag=false,lastX=0,lastY=0;
let previewUrl=null;

function initials(n=''){
  return n.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'FM';
}

function note(t,type='success'){
  const e=$('#profileNotice');
  e.textContent=t;
  e.className=`notice ${type}`;
}

function setPreviewUrl(url){
  if(previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl=url||null;
}

function renderAvatar(p){
  const e=$('#profileAvatar');
  e.innerHTML=p.avatar_path
    ? `<img src="${avatarUrl(p.avatar_path)}?v=${Date.now()}" alt="Foto de perfil">`
    : `<span>${initials(p.nome)}</span>`;
}

function draw(){
  const c=$('#cropCanvas');
  const x=c.getContext('2d');
  x.clearRect(0,0,c.width,c.height);
  const s=baseScale*scale;
  const w=img.width*s,h=img.height*s;
  x.drawImage(img,(c.width-w)/2+offX,(c.height-h)/2+offY,w,h);
}

function openCrop(file){
  const url=URL.createObjectURL(file);
  img.onload=()=>{
    baseScale=Math.max(360/img.width,360/img.height);
    scale=1;
    offX=offY=0;
    $('#cropZoom').value=1;
    draw();
    $('#cropModal').classList.remove('hidden');
    URL.revokeObjectURL(url);
  };
  img.onerror=()=>{
    URL.revokeObjectURL(url);
    note('Não foi possível abrir esta imagem. Escolha outra foto.','error');
  };
  img.src=url;
}

function canvasToBlob(canvas){
  return new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Falha ao gerar imagem')),'image/jpeg',0.9);
  });
}

export function setupProfile(ctx){
  const form=$('#profileEditForm');
  const input=$('#photoInput');
  const choose=$('#choosePhoto');
  const canvas=$('#cropCanvas');
  const modal=$('#cropModal');

  form.nome.value=ctx.profile.nome||'';
  renderAvatar(ctx.profile);

  choose.onclick=()=>input.click();
  input.onchange=e=>{
    const file=e.target.files?.[0];
    // Limpa o input para permitir escolher a MESMA foto novamente e refazer o recorte.
    e.target.value='';
    if(!file) return;
    if(!/^image\/(jpeg|png|webp)$/i.test(file.type)){
      return note('Escolha uma imagem JPG, PNG ou WEBP.','error');
    }
    if(file.size>8*1024*1024){
      return note('A imagem é muito grande. Escolha uma foto de até 8 MB.','error');
    }
    openCrop(file);
  };

  $('#cropZoom').oninput=e=>{
    scale=Number(e.target.value);
    draw();
  };

  canvas.onpointerdown=e=>{
    drag=true;
    lastX=e.clientX;
    lastY=e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove=e=>{
    if(!drag)return;
    offX+=e.clientX-lastX;
    offY+=e.clientY-lastY;
    lastX=e.clientX;
    lastY=e.clientY;
    draw();
  };
  canvas.onpointerup=()=>drag=false;
  canvas.onpointercancel=()=>drag=false;

  $('#cancelCrop').onclick=()=>modal.classList.add('hidden');

  $('#saveCrop').onclick=async()=>{
    try{
      pendingBlob=await canvasToBlob(canvas);
      setPreviewUrl(URL.createObjectURL(pendingBlob));
      $('#profileAvatar').innerHTML=`<img src="${previewUrl}" alt="Prévia da nova foto">`;
      modal.classList.add('hidden');
      note('Novo enquadramento pronto. Clique em SALVAR PERFIL para confirmar.');
    }catch{
      note('Não foi possível preparar a foto. Tente novamente.','error');
    }
  };

  form.onsubmit=async e=>{
    e.preventDefault();
    const btn=form.querySelector('button[type="submit"]');
    btn.disabled=true;
    const oldText=btn.textContent;
    btn.textContent='SALVANDO...';

    const nome=form.nome.value.trim();
    let newPath=ctx.profile.avatar_path||null;
    let uploadedPath=null;

    try{
      if(pendingBlob){
        // Caminho único em cada atualização: evita cache da foto antiga no navegador/CDN.
        uploadedPath=`${ctx.user.id}/avatar-${Date.now()}.jpg`;
        const {error:uploadError}=await sb.storage.from('avatars').upload(uploadedPath,pendingBlob,{
          contentType:'image/jpeg',
          cacheControl:'3600',
          upsert:false
        });
        if(uploadError) throw uploadError;
        newPath=uploadedPath;
      }

      const {error:updateError}=await sb.rpc('update_my_profile',{
        new_name:nome,
        new_avatar_path:newPath
      });
      if(updateError) throw updateError;

      const oldPath=ctx.profile.avatar_path;
      ctx.profile.nome=nome;
      ctx.profile.avatar_path=newPath;

      // Limpeza da foto anterior somente DEPOIS do perfil apontar para a nova.
      if(uploadedPath&&oldPath&&oldPath!==uploadedPath){
        sb.storage.from('avatars').remove([oldPath]).catch(()=>{});
      }

      pendingBlob=null;
      note('Perfil atualizado.');
      setTimeout(()=>location.reload(),350);
    }catch(err){
      // Se a foto nova subiu mas o perfil não foi atualizado, evita deixar arquivo órfão.
      if(uploadedPath){
        try{await sb.storage.from('avatars').remove([uploadedPath]);}catch{}
      }
      console.error(err);
      note('Não foi possível salvar seu perfil. Tente novamente.','error');
    }finally{
      btn.disabled=false;
      btn.textContent=oldText;
    }
  };
}
