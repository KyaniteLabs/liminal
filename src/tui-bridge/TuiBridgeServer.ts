import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'http';
import { TuiBridgeService } from './TuiBridgeService.js';
import type { LLMClient } from '../llm/LLMClient.js';
import type { TuiInputRequest } from './types.js';
import { loadConfig, saveConfig, type UserConfig } from '../config/ConfigLoader.js';
import { resolveOpenRouterModelAlias, OPENROUTER_MODEL_CATALOG } from './OpenRouterModelCatalog.js';
import { LLMClient as RuntimeLLMClient } from '../llm/LLMClient.js';
import { isPlaceholderApiKey } from '../harness/MultiProviderConfig.js';
import { summarizeBridgeRuntime } from './BridgeLauncherConfig.js';
import { formatMicCaptureError } from '../shared/micPermission.js';

type ModelProviderKey = 'custom' | 'minimax' | 'glm' | 'lmstudio' | 'ollama' | 'openrouter' | 'kimi' | 'moonshot';

interface ModelChoice {
  provider: ModelProviderKey;
  label: string;
  model: string;
  aliases: string[];
}

const PROVIDER_ALIASES: Record<string, ModelProviderKey> = {
  openai: 'custom',
  gpt: 'custom',
  custom: 'custom',
  minimax: 'minimax',
  mini: 'minimax',
  glm: 'glm',
  z: 'glm',
  lmstudio: 'lmstudio',
  lm: 'lmstudio',
  local: 'lmstudio',
  ollama: 'ollama',
  openrouter: 'openrouter',
  or: 'openrouter',
  kimi: 'kimi',
  moonshot: 'moonshot',
};

const PROVIDER_DEFAULTS: Record<ModelProviderKey, { baseUrl: string; model: string; label: string; requiresKey: boolean }> = {
  custom: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5.4-mini', label: 'OpenAI', requiresKey: true },
  minimax: { baseUrl: 'https://api.minimax.io/anthropic', model: 'MiniMax-M2.7', label: 'MiniMax', requiresKey: true },
  glm: { baseUrl: 'https://api.z.ai/api/anthropic', model: 'GLM-5v-turbo', label: 'GLM', requiresKey: true },
  lmstudio: { baseUrl: 'http://localhost:1234/v1', model: 'local-model', label: 'LM Studio', requiresKey: false },
  ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.2', label: 'Ollama', requiresKey: false },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-5.4-mini', label: 'OpenRouter', requiresKey: true },
  kimi: { baseUrl: 'https://api.kimi.com/coding/v1', model: 'k2p5', label: 'Kimi', requiresKey: true },
  moonshot: { baseUrl: 'https://api.moonshot.ai/v1', model: 'kimi-k2.5', label: 'Moonshot', requiresKey: true },
};

const MODEL_CHOICES: ModelChoice[] = [
  { provider: 'custom', label: 'GPT-5.4 mini', model: 'gpt-5.4-mini', aliases: ['gpt-5.4-mini', 'gpt54mini', '5.4-mini', 'mini'] },
  { provider: 'custom', label: 'GPT-5.4', model: 'gpt-5.4', aliases: ['gpt-5.4', 'gpt54', '5.4'] },
  { provider: 'custom', label: 'GPT-5.4 nano', model: 'gpt-5.4-nano', aliases: ['gpt-5.4-nano', 'gpt54nano', 'nano'] },
  { provider: 'minimax', label: 'MiniMax M2.7', model: 'MiniMax-M2.7', aliases: ['m27', 'm2.7', 'minimax-m27'] },
  { provider: 'minimax', label: 'MiniMax M2.5', model: 'MiniMax-M2.5', aliases: ['m25', 'm2.5', 'minimax-m25'] },
  { provider: 'glm', label: 'GLM 5V Turbo', model: 'GLM-5v-turbo', aliases: ['glm-5v-turbo', 'glm5v', '5v', 'glm-vision'] },
  { provider: 'glm', label: 'GLM 5.1', model: 'glm-5.1', aliases: ['glm-5.1', 'glm51'] },
  { provider: 'lmstudio', label: 'LM Studio local', model: 'local-model', aliases: ['local', 'lmstudio'] },
  { provider: 'ollama', label: 'Ollama llama3.2', model: 'llama3.2', aliases: ['llama3.2', 'ollama'] },
  { provider: 'kimi', label: 'Kimi K2P5', model: 'k2p5', aliases: ['k2p5', 'kimi'] },
  ...OPENROUTER_MODEL_CATALOG.map((entry): ModelChoice => ({
    provider: 'openrouter',
    label: entry.label,
    model: entry.model,
    aliases: [entry.alias, entry.model],
  })),
];

const MIC_CAPTURE_ERROR_FORMATTER_SOURCE = formatMicCaptureError.toString();

const ALLOWED_ORIGINS: readonly string[] = [
  'http://localhost:3000',
  'http://localhost:4200',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4200',
  'http://127.0.0.1:5173',
];

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

interface BridgeServerOptions {
  port?: number;
  host?: string;
  llm?: LLMClient;
}

export class TuiBridgeServer {
  private readonly bridge: TuiBridgeService;
  private readonly server: Server;
  private readonly port: number;
  private readonly host: string;
  private llm?: LLMClient;

  constructor(bridge: TuiBridgeService, options: BridgeServerOptions = {}) {
    this.llm = options.llm;
    this.bridge = bridge;
    this.port = options.port ?? 3000;
    this.host = options.host ?? 'localhost';
    this.server = createServer((req, res) => { void this.handleRequest(req, res); });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const onError = (err: Error) => {
        this.server.off('listening', onListening);
        reject(err);
      };
      const onListening = () => {
        this.server.off('error', onError);
        resolve();
      };
      this.server.once('error', onError);
      this.server.once('listening', onListening);
      this.server.listen(this.port, this.host, () => {
        // The explicit listening listener above resolves the promise. Keep this
        // callback empty so older Node versions still use the same listen path.
      });
    });
  }

  async stop(): Promise<void> {
    this.server.closeIdleConnections?.();
    this.server.closeAllConnections?.();
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        this.bridge.destroy();
        if (err) reject(err);
        else resolve();
      });
    });
  }

  get address(): string {
    const actual = this.server.address();
    const port = actual && typeof actual === 'object' ? actual.port : this.port;
    return `http://${this.host}:${port}`;
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // CORS headers - restrict to localhost origins only
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const path = url.pathname;

    try {
      // POST /api/tui/session — create a new session
      if (req.method === 'POST' && path === '/api/tui/session') {
        const cfg = this.llm?.getConfig();
        const runtime = summarizeBridgeRuntime();
        const status = this.bridge.createSession({
          provider: cfg ? this.providerLabel(cfg.baseUrl) : undefined,
          model: cfg?.model,
          roles: runtime.roles,
          evaluation: runtime.evaluation,
        });
        this.json(res, 201, status);
        return;
      }

      // GET /api/tui/session/:id/status
      const statusMatch = path.match(/^\/api\/tui\/session\/([^/]+)\/status$/);
      if (req.method === 'GET' && statusMatch) {
        const sessionId = statusMatch[1];
        const status = this.bridge.getStatus(sessionId);
        this.json(res, 200, status);
        return;
      }

      // GET /api/tui/session/:id/events — SSE stream
      const eventsMatch = path.match(/^\/api\/tui\/session\/([^/]+)\/events$/);
      if (req.method === 'GET' && eventsMatch) {
        const sessionId = eventsMatch[1];
        // Validate session exists
        this.bridge.getStatus(sessionId);
        this.handleSSE(req, res, sessionId);
        return;
      }

      // POST /api/tui/session/:id/input
      const inputMatch = path.match(/^\/api\/tui\/session\/([^/]+)\/input$/);
      if (req.method === 'POST' && inputMatch) {
        const sessionId = inputMatch[1];
        const body = await this.readBody(req);
        const input: TuiInputRequest = JSON.parse(body);
        if (this.handleMicPreviewCommand(sessionId, input)) {
          this.json(res, 200, { reviewRequired: false });
          return;
        }
        if (await this.handleModelPicker(sessionId, input)) {
          this.json(res, 200, { reviewRequired: false });
          return;
        }
        // Pass the full LLMClient (not just stream function)
        const result = await this.bridge.submitInput(sessionId, input, this.llm);
        this.json(res, 200, result);
        return;
      }

      // POST /api/tui/session/:id/actions/:actionId/confirm
      const confirmMatch = path.match(/^\/api\/tui\/session\/([^/]+)\/actions\/([^/]+)\/confirm$/);
      if (req.method === 'POST' && confirmMatch) {
        const sessionId = confirmMatch[1];
        const actionId = confirmMatch[2];
        await this.bridge.confirmAction(sessionId, actionId, this.llm);
        this.json(res, 200, { ok: true });
        return;
      }

      // POST /api/tui/session/:id/actions/:actionId/cancel
      const cancelMatch = path.match(/^\/api\/tui\/session\/([^/]+)\/actions\/([^/]+)\/cancel$/);
      if (req.method === 'POST' && cancelMatch) {
        const sessionId = cancelMatch[1];
        const actionId = cancelMatch[2];
        this.bridge.cancelAction(sessionId, actionId);
        this.json(res, 200, { ok: true });
        return;
      }

      // POST /api/tui/session/:id/cancel
      const runCancelMatch = path.match(/^\/api\/tui\/session\/([^/]+)\/cancel$/);
      if (req.method === 'POST' && runCancelMatch) {
        const sessionId = runCancelMatch[1];
        this.bridge.cancelRun(sessionId);
        this.json(res, 200, { ok: true });
        return;
      }

      const micPageMatch = path.match(/^\/api\/tui\/session\/([^/]+)\/mic-preview$/);
      if (req.method === 'GET' && micPageMatch) {
        this.bridge.getStatus(micPageMatch[1]);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(MIC_PREVIEW_HTML);
        return;
      }

      const micUpdateMatch = path.match(/^\/api\/tui\/session\/([^/]+)\/mic-preview\/update$/);
      if (req.method === 'POST' && micUpdateMatch) {
        const sessionId = micUpdateMatch[1];
        this.bridge.getStatus(sessionId);
        const body = await this.readBody(req);
        const payload = JSON.parse(body) as { content?: string; done?: boolean; imageBase64?: string };
        const content = payload.content || '';
        if (payload.imageBase64) {
          if (payload.done) {
            this.bridge.publishEvent<'preview.completed'>(sessionId, { type: 'preview.completed', content: payload.imageBase64, previewType: 'image' });
          } else {
            this.bridge.publishEvent<'preview.content'>(sessionId, { type: 'preview.content', content: payload.imageBase64, previewType: 'image' });
          }
        } else {
          if (payload.done) {
            this.bridge.publishEvent<'preview.completed'>(sessionId, { type: 'preview.completed', content, previewType: 'music' });
          } else {
            this.bridge.publishEvent<'preview.content'>(sessionId, { type: 'preview.content', content, previewType: 'music' });
          }
        }
        this.json(res, 200, { ok: true });
        return;
      }

      // Health check
      if (path === '/health') {
        this.json(res, 200, { status: 'ok', bridge: 'liminal-tui' });
        return;
      }

      this.json(res, 404, { error: 'Not found' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes('not found') || message.includes('Unknown') ? 404 : 500;
      this.json(res, status, { error: message });
    }
  }

  private handleSSE(req: IncomingMessage, res: ServerResponse, sessionId: string): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');

    const lastEventId = Number(req.headers['last-event-id'] || 0) || 0;

    // Send any existing events first
    const existing = this.bridge.getEventsSince(sessionId, lastEventId);
    for (const stored of existing) {
      res.write(`id: ${stored.id}\n`);
      res.write(`data: ${JSON.stringify(stored.event)}\n\n`);
    }

    // Subscribe to new events
    const unsubscribe = this.bridge.subscribeWithId(sessionId, (stored) => {
      const payload = `id: ${stored.id}
data: ${JSON.stringify(stored.event)}

`;
      res.write(payload);
    });

    const heartbeat = setInterval(() => {
      res.write(': ping\n\n');
    }, 15000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }

  private providerLabel(baseUrl: string): string {
    const lower = baseUrl.toLowerCase();
    if (lower.includes('api.openai.com')) return 'openai';
    if (lower.includes('z.ai') || lower.includes('bigmodel') || lower.includes('glm')) return 'glm';
    if (lower.includes('minimax')) return 'minimax';
    if (lower.includes('openrouter')) return 'openrouter';
    if (lower.includes('kimi')) return 'kimi';
    if (lower.includes('localhost') || lower.includes('127.0.0.1')) return 'lmstudio';
    return 'llm';
  }

  private json(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  }

  private handleMicPreviewCommand(sessionId: string, input: TuiInputRequest): boolean {
    const text = input.text.trim();
    if (text !== '/mic' && text !== '/mic-preview') return false;

    const url = `${this.address}/api/tui/session/${sessionId}/mic-preview`;
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

  private async handleModelPicker(sessionId: string, input: TuiInputRequest): Promise<boolean> {
    const text = input.text.trim();
    if (!text.startsWith('/model') && !text.startsWith('/provider')) return false;

    const words = text.split(/\s+/);
    const isProviderCommand = words[0] === '/provider';
    const parts = words.slice(1);
    if (isProviderCommand && parts[0] === 'openrouter') {
      parts.shift();
    }
    if (parts.length === 0) {
      this.bridge.emitCommandResponse(sessionId, await this.renderModelPicker());
      return true;
    }

    const resolved = await this.resolveModelSelection(parts);
    if (!resolved) {
      this.bridge.emitCommandResponse(sessionId, `Unknown model selection: ${parts.join(' ')}\n\n${await this.renderModelPicker()}`);
      return true;
    }

    const loaded = await loadConfig();
    const config = loaded.isErr()
      ? ({ defaultProvider: resolved.provider, providers: {} } as UserConfig)
      : (loaded.value as UserConfig);
    const providerConfig = config.providers?.[resolved.provider] ?? {};
    const defaults = PROVIDER_DEFAULTS[resolved.provider];

    const apiKey = this.resolveApiKey(resolved.provider, providerConfig.apiKey);
    if (defaults.requiresKey && !apiKey) {
      this.bridge.emitCommandResponse(sessionId, `${defaults.label} API key not found. Set providers.${resolved.provider}.apiKey in ~/.liminal/config.json before switching.`);
      return true;
    }

    config.defaultProvider = resolved.provider;
    config.providers = config.providers || {};
    config.providers[resolved.provider] = {
      ...providerConfig,
      baseUrl: this.resolveProviderBaseUrl(resolved.provider, providerConfig.baseUrl, defaults.baseUrl),
      model: resolved.model,
    };
    if (apiKey) config.providers[resolved.provider].apiKey = apiKey;
    await saveConfig(config);

    this.llm = new RuntimeLLMClient({
      role: 'harness',
      baseUrl: config.providers[resolved.provider].baseUrl,
      model: resolved.model,
      apiKey,
      temperature: 0.5,
      maxTokens: 4096,
    });

    this.bridge.updateStatus(sessionId, {
      provider: resolved.provider === 'custom' ? 'openai' : resolved.provider,
      model: resolved.model,
      activeTask: `Model switched to ${resolved.label}`,
    });
    this.bridge.emitCommandResponse(sessionId, `Switched model to ${resolved.label} (${resolved.model}) via ${PROVIDER_DEFAULTS[resolved.provider].label}`);
    return true;
  }

  private resolveProviderBaseUrl(provider: ModelProviderKey, configuredBaseUrl: string | undefined, defaultBaseUrl: string): string {
    if (!configuredBaseUrl) return defaultBaseUrl;

    const lower = configuredBaseUrl.toLowerCase().replace(/\/+$/, '');
    if (provider === 'glm' && lower.includes('api.z.ai/api/coding/paas')) {
      return defaultBaseUrl;
    }
    if (provider === 'minimax' && lower === 'https://api.minimax.io/v1') {
      return defaultBaseUrl;
    }

    return configuredBaseUrl;
  }

  private async renderModelPicker(): Promise<string> {
    const loaded = await loadConfig();
    const config = loaded.isErr() ? undefined : (loaded.value as UserConfig);
    const currentConfig = this.llm?.getConfig();
    const currentModel = currentConfig?.model;
    const currentProvider = currentConfig?.baseUrl ? this.providerLabel(currentConfig.baseUrl) : config?.defaultProvider;
    const lines = [
      'Model picker:',
      `Current: ${currentProvider || 'unknown'}/${currentModel || 'unknown'}`,
      '',
      'Type /model NUMBER, /model PROVIDER, or /model PROVIDER MODEL',
      '',
    ];
    MODEL_CHOICES.forEach((choice, index) => {
      const marker = choice.model === currentModel ? ' (current)' : '';
      lines.push(`${String(index + 1).padStart(2, ' ')}. ${PROVIDER_DEFAULTS[choice.provider].label.padEnd(10)} ${choice.label.padEnd(18)} ${choice.model}${marker}`);
    });
    lines.push('');
    lines.push('Examples: /model 1, /model glm 5v, /model openai gpt-5.4-mini, /model lmstudio, /model ollama llama3.2, /model minimax m27');
    return lines.join('\n');
  }

  private async resolveModelSelection(parts: string[]): Promise<ModelChoice | null> {
    const first = parts[0]?.toLowerCase();
    const numericChoice = Number(first);
    if (Number.isInteger(numericChoice) && numericChoice >= 1 && numericChoice <= MODEL_CHOICES.length) {
      return MODEL_CHOICES[numericChoice - 1];
    }

    const provider = PROVIDER_ALIASES[first] ?? (first as ModelProviderKey);
    if (!PROVIDER_DEFAULTS[provider]) {
      return this.resolveChoiceByAlias(parts.join(' '));
    }

    const selection = parts.slice(1).join(' ').trim();
    if (!selection) {
      const loaded = await loadConfig();
      const config = loaded.isErr() ? undefined : (loaded.value as UserConfig);
      const configuredModel = config?.providers?.[provider]?.model;
      return {
        provider,
        label: configuredModel || PROVIDER_DEFAULTS[provider].model,
        model: configuredModel || PROVIDER_DEFAULTS[provider].model,
        aliases: [],
      };
    }

    if (provider === 'openrouter') {
      const openRouterAlias = resolveOpenRouterModelAlias(selection);
      if (openRouterAlias) {
        return {
          provider,
          label: openRouterAlias.label,
          model: openRouterAlias.model,
          aliases: [openRouterAlias.alias],
        };
      }
    }

    const providerChoice = MODEL_CHOICES.find((choice) =>
      choice.provider === provider &&
      (choice.model.toLowerCase() === selection.toLowerCase() ||
        choice.aliases.some((alias) => alias.toLowerCase() === selection.toLowerCase())),
    );
    return providerChoice ?? {
      provider,
      label: selection,
      model: selection,
      aliases: [],
    };
  }

  private resolveChoiceByAlias(selection: string): ModelChoice | null {
    const normalized = selection.toLowerCase().trim();
    return MODEL_CHOICES.find((choice) =>
      choice.model.toLowerCase() === normalized ||
      choice.aliases.some((alias) => alias.toLowerCase() === normalized),
    ) ?? null;
  }

  private resolveApiKey(provider: ModelProviderKey, configuredKey?: string): string | undefined {
    const firstUsable = (...values: Array<string | undefined>) =>
      values.find(value => !isPlaceholderApiKey(value));
    const currentConfig = this.llm?.getConfig();
    const currentProvider = currentConfig?.baseUrl ? this.providerLabel(currentConfig.baseUrl) : undefined;
    const currentMatchesTarget = currentProvider === provider || (provider === 'custom' && currentProvider === 'openai');
    const current = currentMatchesTarget ? currentConfig?.apiKey : undefined;
    switch (provider) {
      case 'custom':
        return firstUsable(configuredKey, current, process.env.OPENAI_API_KEY, process.env.LIMINAL_LLM_API_KEY, process.env.LLM_API_KEY);
      case 'minimax':
        return firstUsable(configuredKey, current, process.env.MINIMAX_API_KEY, process.env.LIMINAL_LLM_API_KEY, process.env.LLM_API_KEY);
      case 'glm':
        return firstUsable(configuredKey, current, process.env.GLM_API_KEY, process.env.ANTHROPIC_AUTH_TOKEN, process.env.LIMINAL_LLM_API_KEY, process.env.LLM_API_KEY);
      case 'openrouter':
        return firstUsable(configuredKey, current, process.env.OPENROUTER_API_KEY);
      case 'kimi':
      case 'moonshot':
        return firstUsable(configuredKey, current, process.env.KIMI_API_KEY, process.env.MOONSHOT_API_KEY);
      case 'lmstudio':
      case 'ollama':
        return undefined;
    }
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  }
}
