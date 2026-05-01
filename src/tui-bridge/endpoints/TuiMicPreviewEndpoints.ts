import type { TuiInputRequest } from '../types.js';
import { formatMicCaptureError } from '../../shared/micPermission.js';
import type { TuiBridgeEvent, TuiSessionStatus } from '../types.js';

interface MicPreviewBridge {
  getStatus(sessionId: string): TuiSessionStatus;
  publishEvent<T extends TuiBridgeEvent['type']>(sessionId: string, event: Omit<Extract<TuiBridgeEvent, { type: T }>, 'sessionId'>): void;
  emitCommandResponse(sessionId: string, message: string): void;
}

const MIC_CAPTURE_ERROR_FORMATTER_SOURCE = formatMicCaptureError.toString();

const MIC_PREVIEW_HTML = String.raw`<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Liminal Mic Preview</title>
<style>body{margin:0;background:#07090f;color:#e5e7eb;font-family:Inter,system-ui,sans-serif}main{max-width:940px;margin:0 auto;padding:28px}button{border:1px solid #59e1ff;background:#11131a;color:#e5e7eb;border-radius:6px;padding:10px 14px;font:inherit;cursor:pointer;margin-right:8px}.meter{height:24px;background:#11131a;border:1px solid #334155;border-radius:6px;overflow:hidden;margin:16px 0}.bar{height:100%;width:0;background:linear-gradient(90deg,#58c777,#59e1ff,#f2b84b)}canvas{display:block;width:100%;height:auto;aspect-ratio:16/9;border:1px solid #334155;border-radius:8px;background:#05070f;margin:16px 0}pre{white-space:pre-wrap;background:#11131a;border:1px solid #334155;border-radius:6px;padding:12px}.hint{color:#f2b84b}</style>
</head>
<body><main><h1>Liminal Mic Preview</h1><p class="hint">Click Start, then speak, sing, hum, or make noise. Words become prompt text; nonverbal sound becomes synesthetic visual direction.</p><button id="start">Start recording</button><button id="stop" disabled>Stop</button><div class="meter"><div id="bar" class="bar"></div></div><canvas id="scene" width="960" height="540"></canvas><pre id="out">idle</pre></main>
<script>
let stream,ctx,analyser,timeData,freqData,raf,frames=[],lastSent=0,spokenPrompt='',recognition=null;
const bar=document.getElementById('bar'),out=document.getElementById('out'),canvas=document.getElementById('scene'),drawCtx=canvas.getContext('2d');
let glyphs=['speak','sing','hum','noise','image'];
function rms(values){let s=0;for(const v of values){const x=(v-128)/128;s+=x*x}return Math.sqrt(s/values.length)}
function centroid(freq){let sum=0,weighted=0;for(let i=0;i<freq.length;i++){sum+=freq[i];weighted+=freq[i]*i}return sum?weighted/sum/freq.length:0}
async function send(content, done=false, imageBase64){await fetch(location.pathname+'/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content,done,imageBase64})}).catch(()=>{})}
function audioWords(avg,peak,cent){const energy=peak>.22?'high-energy':peak>.08?'soft':'quiet';const tone=cent>.32?'bright':cent>.16?'clear':'low';return [energy,tone,'synesthetic','sound-shape'].join(' ')}
function promptText(avg,peak,cent){return spokenPrompt.trim()||audioWords(avg,peak,cent)}
function content(final=false){const vals=frames.map(f=>f.rms);const peak=vals.length?Math.max(...vals):0;const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;const range=vals.length?peak-Math.min(...vals):0;const cent=frames.length?frames.reduce((a,b)=>a+b.centroid,0)/frames.length:0;return ['Prompt: '+promptText(avg,peak,cent),'Speech text: '+(spokenPrompt||'(none; using sound features)'),'RMS: '+avg.toFixed(3),'Peak: '+peak.toFixed(3),'Range: '+range.toFixed(3),'Centroid: '+cent.toFixed(3),'Output: synesthetic image generated from microphone input','Visual: palette + motion + text respond to words/sound','brightnessDriven: true','rippleScaleDriven: true','particleSpeedDriven: true','typographyScaleDriven: true', final?'Status: stopped':'Status: recording'].join('\n')}
function hashHue(text){let h=0;for(let i=0;i<text.length;i++)h=(h*31+text.charCodeAt(i))%360;return h}
function drawOutput(level,cent){const w=canvas.width,h=canvas.height,t=performance.now()/1000;const phrase=promptText(level,level,cent);const hue=hashHue(phrase);glyphs=phrase.split(/\s+/).filter(Boolean).slice(0,5);while(glyphs.length<5)glyphs.push(['voice','sound','color','motion','dream'][glyphs.length]);drawCtx.fillStyle='hsl('+hue+' 55% '+(6+level*18)+'%)';drawCtx.fillRect(0,0,w,h);const sky=drawCtx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'hsl('+hue+' 50% '+(10+level*18)+'%)');sky.addColorStop(1,'hsl('+(hue+70)%360+' 60% 5%)');drawCtx.fillStyle=sky;drawCtx.globalAlpha=.55+level*.35;drawCtx.fillRect(0,0,w,h);drawCtx.globalAlpha=1;const glow=drawCtx.createRadialGradient(w/2,h*.66,12,w/2,h*.66,w*.78);glow.addColorStop(0,'rgba(89,225,255,'+(.18+level*.62)+')');glow.addColorStop(1,'rgba(5,7,15,0)');drawCtx.fillStyle=glow;drawCtx.fillRect(0,0,w,h);drawCtx.fillStyle='rgba(248,250,252,'+(.72+level*.25)+')';drawCtx.beginPath();drawCtx.arc(w*.80,h*.18,40+level*34,0,Math.PI*2);drawCtx.fill();drawCtx.strokeStyle='rgba(199,207,249,'+(.17+level*.7)+')';drawCtx.lineWidth=1+level*9;for(let i=0;i<14;i++){drawCtx.beginPath();drawCtx.ellipse(w/2,h*.65,75+i*36+level*170,15+i*5+level*42,Math.sin(t*.5+cent)*.23,0,Math.PI*2);drawCtx.stroke()}for(let i=0;i<110;i++){const a=t*(.22+level*3.2)+i*.41;const r=62+(i%32)*9+level*180;const x=w/2+Math.cos(a)*r;const y=h/2+Math.sin(a*1.65+t*.2)*(r*.34+level*95);const g=drawCtx.createRadialGradient(x,y,0,x,y,7+level*46);g.addColorStop(0,'hsl('+((hue+i*37)%360)+' 90% '+(55+level*30)+'%)');g.addColorStop(1,'rgba(0,0,0,0)');drawCtx.fillStyle=g;drawCtx.beginPath();drawCtx.arc(x,y,7+level*27,0,Math.PI*2);drawCtx.fill()}drawCtx.font='700 '+Math.round(26+level*70)+'px Georgia';drawCtx.textAlign='center';drawCtx.fillStyle='rgba(248,250,252,'+(.45+level*.55)+')';drawCtx.shadowBlur=18+level*80;drawCtx.shadowColor='#59e1ff';drawCtx.fillText(phrase.toUpperCase().slice(0,28),w/2,h*.80);drawCtx.shadowBlur=0;drawCtx.font='18px ui-monospace, Menlo, monospace';drawCtx.fillStyle='rgba(229,222,77,'+(.28+level*.5)+')';for(let i=0;i<glyphs.length;i++){drawCtx.fillText(glyphs[i],w*.15+i*w*.17,h*.90+Math.sin(t+i)*8)}}
function frameImage(){return canvas.toDataURL('image/png').split(',')[1]}
function tick(){analyser.getByteTimeDomainData(timeData);analyser.getByteFrequencyData(freqData);const level=rms(timeData);const cent=centroid(freqData);frames.push({rms:level,centroid:cent});if(frames.length>1200)frames.shift();bar.style.width=Math.min(100,level*260)+'%';drawOutput(level,cent);const c=content(false);out.textContent=c;if(performance.now()-lastSent>650){lastSent=performance.now();send(c,false,frameImage())}raf=requestAnimationFrame(tick)}
drawOutput(0,0);
function startSpeech(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return;recognition=new SR();recognition.continuous=true;recognition.interimResults=true;recognition.onresult=(event)=>{let text='';for(let i=0;i<event.results.length;i++)text+=event.results[i][0].transcript+' ';spokenPrompt=text.trim();};recognition.start();}
const formatMicCaptureError=${MIC_CAPTURE_ERROR_FORMATTER_SOURCE};
function showMicError(err){cancelAnimationFrame(raf);recognition?.stop?.();stream?.getTracks?.().forEach(t=>t.stop());ctx?.close?.();stream=null;ctx=null;analyser=null;document.getElementById('start').disabled=false;document.getElementById('stop').disabled=true;const c=['Status: microphone unavailable',formatMicCaptureError(err,'press Start recording again'),'No audio was captured yet.'].join('\n');out.textContent=c;send(c,false).catch(()=>{})}
async function startMicPreview(){
try{
startSpeech();
stream=await navigator.mediaDevices.getUserMedia({audio:true});
ctx=new AudioContext();
analyser=ctx.createAnalyser();
analyser.fftSize=2048;
timeData=new Uint8Array(analyser.fftSize);
freqData=new Uint8Array(analyser.frequencyBinCount);
ctx.createMediaStreamSource(stream).connect(analyser);
frames=[];
document.getElementById('start').disabled=true;
document.getElementById('stop').disabled=false;
tick();
}catch(err){
showMicError(err);
}
}
document.getElementById('start').onclick=startMicPreview;
document.getElementById('stop').onclick=()=>{cancelAnimationFrame(raf);recognition?.stop();stream?.getTracks().forEach(t=>t.stop());ctx?.close();document.getElementById('start').disabled=false;document.getElementById('stop').disabled=true;const c=content(true);out.textContent=c;send(c,true,frameImage())};
</script></body></html>`;


export interface MicPreviewUpdatePayload {
  content?: string;
  done?: boolean;
  imageBase64?: string;
}

export class TuiMicPreviewEndpoints {
  constructor(
    private readonly bridge: MicPreviewBridge,
    private readonly addressForSession: (sessionId: string) => string,
  ) {}

  handleCommand(sessionId: string, input: TuiInputRequest): boolean {
    const text = input.text.trim();
    if (text !== '/mic' && text !== '/mic-preview') return false;

    const url = `${this.addressForSession(sessionId)}/api/tui/session/${sessionId}/mic-preview`;
    const content = [
      'Mic preview controls',
      'Physical mic capture page: ' + url,
      'Output: nocturnal kinetic pond',
      'RMS: 0',
      'Peak: 0',
      'brightnessDriven: true',
      'rippleScaleDriven: true',
      'particleSpeedDriven: true',
      'typographyScaleDriven: true',
    ].join('\n');
    this.bridge.publishEvent<'preview.started'>(sessionId, { type: 'preview.started', previewType: 'music' });
    this.bridge.publishEvent<'preview.content'>(sessionId, { type: 'preview.content', content, previewType: 'music' });
    this.bridge.publishEvent<'activity.updated'>(sessionId, { type: 'activity.updated', message: `Mic recorder is ready in Studio; browser auto-open is disabled. URL: ${url}` });
    this.bridge.emitCommandResponse(sessionId, `Mic recorder is ready in Studio. If you need physical mic capture, open this URL manually: ${url}\nPress Ctrl+E to watch the operator panel.`);
    return true;
  }

  renderPage(sessionId: string): string {
    this.bridge.getStatus(sessionId);
    return MIC_PREVIEW_HTML;
  }

  applyUpdate(sessionId: string, payload: MicPreviewUpdatePayload): void {
    this.bridge.getStatus(sessionId);
    const content = payload.content || '';
    if (payload.imageBase64) {
      if (payload.done) {
        this.bridge.publishEvent<'preview.completed'>(sessionId, { type: 'preview.completed', content: payload.imageBase64, previewType: 'image' });
      } else {
        this.bridge.publishEvent<'preview.content'>(sessionId, { type: 'preview.content', content: payload.imageBase64, previewType: 'image' });
      }
      return;
    }

    if (payload.done) {
      this.bridge.publishEvent<'preview.completed'>(sessionId, { type: 'preview.completed', content, previewType: 'music' });
    } else {
      this.bridge.publishEvent<'preview.content'>(sessionId, { type: 'preview.content', content, previewType: 'music' });
    }
  }
}
