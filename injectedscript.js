// ==========================================
// 1. WASM GRID SNAP ENGINE
// ==========================================
(() => {
  "use strict";
  const WASM_BUILD = "236a06dc9063b747832944747c8d9f6c.wasm.br";
  const KEYS = { xz: "__dcgs_snap_xz", y: "__dcgs_snap_y", rotation: "__dcgs_rotation_step" };
  const DEFAULTS = { xz: 15, y: 15, rotation: 90 };
  const LIMITS = { xz: [1, 30], y: [1, 30], rotation: [1, 359] };
  const ROTATION_FUNCTIONS = [58120, 58127];
  const ROTATE_Y_90 = [
    0x43,0x00,0x00,0x00,0x00,
    0x43,0x00,0x00,0xb4,0x42,
    0x43,0x00,0x00,0x00,0x00,
    0x41,0x00,0x10,0xc8,0xf3,0x04
  ];
  const SITES = [
    { offset: 0x1063153, kind: "float", type: "xz-half", original: 7.5 },
    { offset: 0x106317b, kind: "float", type: "xz-float", original: 15 },
    { offset: 0x10631d7, kind: "float", type: "xz-half", original: 7.5 },
    { offset: 0x10631ff, kind: "float", type: "xz-float", original: 15 },
    { offset: 0x106326a, kind: "int", type: "y-int", original: 15 },
    { offset: 0x1063271, kind: "int", type: "xz-int", original: 15 },
    { offset: 0x106327a, kind: "int", type: "xz-int", original: 15 },
    { offset: 0x106197d, kind: "int", type: "y-int", original: 15 },
    { offset: 0x10619e5, kind: "int", type: "y-int", original: 15 },
    { offset: 0x1061c94, kind: "int", type: "y-int", original: 15 },
    { offset: 0x106389a, kind: "float", type: "y-float", original: 15 },
    { offset: 0x1062b11, kind: "int", type: "level-cap", original: 100, after: [0x20,0x04] },
    { offset: 0x1062b16, kind: "int", type: "level-cap", original: 100, after: [0x48] }
  ].sort((a,b)=>a.offset-b.offset);

  function readSetting(key) {
    const [min,max] = LIMITS[key];
    try {
      const n = Number.parseInt(localStorage.getItem(KEYS[key]) || String(DEFAULTS[key]), 10);
      if (Number.isInteger(n) && n >= min && n <= max) return n;
    } catch (_) {}
    return DEFAULTS[key];
  }

  function hasBytes(bytes, offset, expected) {
    return offset >= 0 && offset + expected.length <= bytes.length && expected.every((v,i)=>bytes[offset+i]===v);
  }

  function readLeb(bytes, pos) {
    let value=0, shift=0, p=pos, byte;
    do { if (p>=bytes.length || shift>35) throw new Error("[DashCraft Tools] Invalid WASM LEB128"); byte=bytes[p++]; value |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
    return { value: value >>> 0, next: p, length: p-pos };
  }

  function encodeUleb(value) {
    const out=[]; let v=value>>>0;
    do { let b=v&0x7f; v>>>=7; if(v) b|=0x80; out.push(b); } while(v);
    return out;
  }

  function encodeSignedLeb(value) {
    const out=[]; let more=true;
    while(more) {
      let byte=value & 0x7f; value >>= 7;
      const sign=(byte & 0x40)!==0;
      more=!((value===0 && !sign)||(value===-1 && sign));
      if(more) byte |= 0x80;
      out.push(byte);
    }
    return out;
  }

  function encodeF32(value) {
    const bytes=new Uint8Array(4); new DataView(bytes.buffer).setFloat32(0,value,true); return [...bytes];
  }

  function concat(parts) {
    const length=parts.reduce((n,p)=>n+p.length,0), out=new Uint8Array(length); let at=0;
    for(const part of parts){out.set(part,at);at+=part.length;} return out;
  }

  function findSequences(bytes, sequence) {
    const matches=[];
    for(let i=0;i<=bytes.length-sequence.length;i++) {
      let found=true;
      for(let j=0;j<sequence.length;j++) if(bytes[i+j]!==sequence[j]) { found=false; break; }
      if(found) matches.push(i);
    }
    return matches;
  }

  function addRotationEdits(bodies, degrees) {
    for(const functionIndex of ROTATION_FUNCTIONS) {
      const body=bodies.find(candidate=>candidate.functionIndex===functionIndex);
      if(!body) throw new Error(`[DashCraft Tools] Rotation function ${functionIndex} not found`);
      const matches=findSequences(body.bytes,ROTATE_Y_90);
      if(matches.length!==1) throw new Error(`[DashCraft Tools] Expected one 90-degree Transform.Rotate anchor in function ${functionIndex}; found ${matches.length}`);
      const at=body.start+matches[0]+5;
      body.edits.push({at,oldLength:5,replacement:new Uint8Array([0x43,...encodeF32(degrees)]),baseOffset:at});
    }
  }

  function gridTextureInjection(xz) {
    const tiling=1500/xz;
    return new Uint8Array([
      0x23,0x00, 0x41,0x10, 0x6b, 0x22,0x02, 0x24,0x00,
      0x20,0x00, 0x28,0x02,0x54, 0x21,0x01,
      0x20,0x01, 0x45, 0x04,0x40, 0x05,
      0x20,0x01, 0x41,0x00, 0x10,...encodeUleb(80017), 0x21,0x01,
      0x20,0x01, 0x45, 0x04,0x40, 0x05,
      0x41,...encodeSignedLeb(5403640), 0x10,...encodeUleb(1870), 
      0x20,0x01, 0x41,...encodeSignedLeb(5403640), 0x28,0x02,0x00, 0x10,...encodeUleb(69304), 0x21,0x01,
      0x20,0x01, 0x45, 0x04,0x40, 0x05,
      0x20,0x01, 0x41,0x00, 0x10,...encodeUleb(66481), 0x21,0x01,
      0x20,0x01, 0x45, 0x04,0x40, 0x05,
      0x20,0x02, 0x43,...encodeF32(tiling), 0x38,0x02,0x00,
      0x20,0x02, 0x43,...encodeF32(tiling), 0x38,0x02,0x04,
      0x20,0x01, 0x20,0x02, 0x41,0x00, 0x10,...encodeUleb(66556),
      0x0b,0x0b,0x0b,0x0b,
      0x20,0x02, 0x41,0x10, 0x6a, 0x24,0x00
    ]);
  }

  function parseImportedCounts(section) {
    if(!section) return {functions:0,globals:0};
    const b=section.payload; let p=0; const count=readLeb(b,p); p=count.next;
    let functions=0,globals=0;
    for(let i=0;i<count.value;i++) {
      for(let n=0;n<2;n++){const name=readLeb(b,p);p=name.next+name.value;}
      const kind=b[p++];
      if(kind===0){p=readLeb(b,p).next;functions++;}
      else if(kind===1){p++;const flags=readLeb(b,p);p=readLeb(b,flags.next).next;if(flags.value&1)p=readLeb(b,p).next;}
      else if(kind===2){const flags=readLeb(b,p);p=readLeb(b,flags.next).next;if(flags.value&1)p=readLeb(b,p).next;}
      else if(kind===3){p+=2;globals++;}
      else if(kind===4){p=readLeb(b,p).next;p=readLeb(b,p).next;}
      else throw new Error(`[DashCraft Tools] Unknown WASM import kind ${kind}`);
    }
    if(p!==b.length) throw new Error("[DashCraft Tools] Could not parse WASM imports exactly");
    return {functions,globals};
  }

  function parseSections(bytes) {
    const sections=[]; let p=8;
    while(p<bytes.length) {
      const begin=p, id=bytes[p++], size=readLeb(bytes,p), payloadStart=size.next, payloadEnd=payloadStart+size.value;
      if(payloadEnd>bytes.length) throw new Error("[DashCraft Tools] WASM section extends beyond file");
      sections.push({id,begin,payloadStart,payloadEnd,payload:bytes.subarray(payloadStart,payloadEnd)}); p=payloadEnd;
    }
    return sections;
  }

  function makeResponse(bytes, original) {
    const headers=new Headers(original.headers);
    headers.delete("content-encoding"); headers.delete("content-length"); headers.delete("content-range");
    headers.set("content-type","application/wasm");
    return new Response(bytes,{status:original.status,statusText:original.statusText,headers});
  }

  function patchWasm(buffer, values) {
    const original=new Uint8Array(buffer);
    if(original.length<8 || original[0]!==0 || original[1]!==0x61 || original[2]!==0x73 || original[3]!==0x6d)
      return {ok:false,reason:"WASM header mismatch",bytes:original};
    let sections;
    try { sections=parseSections(original); } catch(e) { return {ok:false,reason:e.message,bytes:original}; }
    const code=sections.find(s=>s.id===10);
    if(!code) return {ok:false,reason:"WASM code section not found",bytes:original};
    try {
      const imported=parseImportedCounts(sections.find(s=>s.id===2));
      let q=code.payloadStart; const count=readLeb(original,q); q=count.next;
      const bodies=[];
      for(let i=0;i<count.value;i++) {
        const size=readLeb(original,q), bodyStart=size.next, bodyEnd=bodyStart+size.value;
        if(bodyEnd>code.payloadEnd) throw new Error("[DashCraft Tools] WASM function extends beyond code section");
        bodies.push({index:imported.functions+i,functionIndex:imported.functions+i,start:bodyStart,end:bodyEnd,bytes:original.subarray(bodyStart,bodyEnd),edits:[]});
        q=bodyEnd;
      }
      if(q!==code.payloadEnd) throw new Error("[DashCraft Tools] Could not parse WASM code section exactly");

      for(const site of SITES) {
        const at=site.offset;
        if(site.kind==="float") {
          if(at<0 || at+5>original.length || original[at]!==0x43)
            throw new Error(`[DashCraft Tools] WASM target mismatch at 0x${site.offset.toString(16)} (float)`);
          const body=bodies.find(b=>at>=b.start && at<b.end);
          if(!body) throw new Error(`[DashCraft Tools] No function body at 0x${site.offset.toString(16)}`);
          let replacementValue;
          if(site.type==="xz-half") replacementValue=values.xz/2;
          else if(site.type==="xz-float") replacementValue=values.xz;
          else if(site.type==="y-float") replacementValue=values.y;
          else replacementValue=site.original;
          const replacement=new Uint8Array(5); replacement[0]=0x43;
          new DataView(replacement.buffer).setFloat32(1,replacementValue,true);
          body.edits.push({at,oldLength:5,replacement,baseOffset:site.offset});
        } else {
          if(at<0 || at+2>=original.length || original[at]!==0x41)
            throw new Error(`[DashCraft Tools] WASM target mismatch at 0x${site.offset.toString(16)} (integer)`);
          let pos=at+1, shift=0, byte, immediateLength=0;
          do {
            if(pos>=original.length || shift>35) throw new Error("[DashCraft Tools]Invalid signed LEB128 at patch target");
            byte=original[pos++]; immediateLength++; shift+=7;
          } while(byte&0x80);
          const following=site.after||[0x6c];
          if(!following.every((value,index)=>original[at+1+immediateLength+index]===value))
            throw new Error(`[DashCraft Tools] WASM multiply instruction mismatch at 0x${site.offset.toString(16)}`);
          const oldLength=1+immediateLength;
          const body=bodies.find(b=>at>=b.start && at<b.end);
          if(!body) throw new Error(`[DashCraft Tools] No function body at 0x${site.offset.toString(16)}`);
          let replacementValue=site.original;
          if(site.type==="y-int") replacementValue=values.y;
          else if(site.type==="xz-int") replacementValue=values.xz;
          else if(site.type==="level-cap") replacementValue=100000;
          const replacement=new Uint8Array([0x41,...encodeSignedLeb(replacementValue)]);
          body.edits.push({at,oldLength,replacement,baseOffset:site.offset});
        }
      }
      addRotationEdits(bodies,values.rotation);
      const gridBody=bodies.find(b=>b.functionIndex===58206);
      const gridInsertionAt=gridBody?.start+112;
      if(!gridBody || original[gridInsertionAt]!==0x20 || original[gridInsertionAt+1]!==0x00)
        throw new Error("[DashCraft Tools] Visible-grid ApplySettings anchor mismatch");
      gridBody.edits.push({at:gridInsertionAt,oldLength:0,replacement:gridTextureInjection(values.xz),baseOffset:gridInsertionAt});
      const rebuiltBodies=[];
      for(const body of bodies) {
        if(!body.edits.length) { rebuiltBodies.push(concat([encodeUleb(body.bytes.length),body.bytes])); continue; }
        body.edits.sort((a,b)=>a.at-b.at);
        const pieces=[]; let cursor=body.start;
        for(const edit of body.edits) {
          if(edit.at<cursor || edit.at+edit.oldLength>body.end) throw new Error("[DashCraft Tools] Overlapping or out-of-range WASM patch");
          pieces.push(original.subarray(cursor,edit.at));
          pieces.push(edit.replacement);
          cursor=edit.at+edit.oldLength;
        }
        pieces.push(original.subarray(cursor,body.end));
        const bodyBytes=concat(pieces);
        rebuiltBodies.push(concat([encodeUleb(bodyBytes.length),bodyBytes]));
      }
      const newCodePayload=concat([encodeUleb(count.value),...rebuiltBodies]);
      const newCodeSection=concat([new Uint8Array([10]),encodeUleb(newCodePayload.length),newCodePayload]);
      const outSections=[];
      for(const section of sections) outSections.push(section.id===10?newCodeSection:original.subarray(section.begin,section.payloadEnd));
      return {ok:true,bytes:concat([original.subarray(0,8),...outSections])};
    } catch(e) { return {ok:false,reason:e.message,bytes:original}; }
  }

  if(window.__snapSickleGridSnap100Test2Installed) return;
  window.__snapSickleGridSnap100Test2Installed=true;
  const originalFetch=window.fetch;
  if(typeof originalFetch!=="function") return;
  window.fetch=async function(input,init) {
    let response;
    try {
      const fetchInput = (input instanceof Request) ? input.clone() : input;
      response = await Reflect.apply(originalFetch, window, [fetchInput, init]);
    } catch (err) {
      console.warn("[DashCraft Tools] Network request failed:", err);
      return; 
    }
    let url=""; try { url=typeof input==="string" ? input : input.url; } catch (_) {}
    if(!url.includes(WASM_BUILD) || !response.ok) return response;
    let originalBytes;
    try {
      originalBytes=await response.arrayBuffer();
      const values={xz:readSetting("xz"),y:readSetting("y"),rotation:readSetting("rotation")};
      const result=patchWasm(originalBytes,values);
      if(!result.ok) {
        console.warn(`[DashCraft Tools] WASM was not patched (${result.reason}); original bytes are preserved.`);
        document.documentElement?.setAttribute("data-dcgs-patch","mismatch");
        document.documentElement?.setAttribute("data-dcgs-reason",result.reason);
        return makeResponse(result.bytes,response);
      }
      document.documentElement?.setAttribute("data-dcgs-patch","applied");
      document.documentElement?.setAttribute("data-dcgs-xz",String(values.xz));
      document.documentElement?.setAttribute("data-dcgs-y",String(values.y));
      document.documentElement?.setAttribute("data-dcgs-rotation",String(values.rotation));
      console.info(`[DashCraft Tools] X/Z: ${values.xz}; Y: ${values.y}; rotation step: ${values.rotation} degrees.`);
      return makeResponse(result.bytes,response);
    } catch(error) {
      console.error("[DashCraft Tools] Patch failed; original game code remains available.",error);
      document.documentElement?.setAttribute("data-dcgs-patch","failed");
      document.documentElement?.setAttribute("data-dcgs-reason",String(error?.message||error));
      if(originalBytes) return makeResponse(originalBytes,response);
      return response;
    }
  };
})();

// ==========================================
// 2. GRID SNAP UI STATE & HELPERS
// ==========================================
let gridSnap = {
    xz: parseInt(localStorage.getItem("__dcgs_snap_xz"), 10) || 15,
    y: parseInt(localStorage.getItem("__dcgs_snap_y"), 10) || 15,
    rotation: parseInt(localStorage.getItem("__dcgs_rotation_step"), 10) || 90,
    
    clamp: (val, min = 1, max = 30) => {
        let n = parseInt(val, 10);
        if (isNaN(n)) return min;
        return Math.min(Math.max(n, min), max);
    },
    resetXZInput: (input) => { input.value = gridSnap.xz; },
    setXZ: (input) => {
        if (!input || !input.value) return;
        let val = gridSnap.clamp(input.value, 1, 30);
        gridSnap.xz = val;
        localStorage.setItem("__dcgs_snap_xz", String(val));
        try { chrome.storage.local.set({ dashcraftGridSnapXZ: val }); } catch(_) {}
    },
    blurXZ: (input) => {
        if (!input) return;
        let val = gridSnap.clamp(input.value, 1, 30);
        gridSnap.xz = val;
        input.value = val;
        localStorage.setItem("__dcgs_snap_xz", String(val));
        try { chrome.storage.local.set({ dashcraftGridSnapXZ: val }); } catch(_) {}
    },
    resetYInput: (input) => { input.value = gridSnap.y; },
    setY: (input) => {
        if (!input || !input.value) return;
        let val = gridSnap.clamp(input.value, 1, 30);
        gridSnap.y = val;
        localStorage.setItem("__dcgs_snap_y", String(val));
        try { chrome.storage.local.set({ dashcraftGridSnapY: val }); } catch(_) {}
    },
    blurY: (input) => {
        if (!input) return;
        let val = gridSnap.clamp(input.value, 1, 30);
        gridSnap.y = val;
        input.value = val;
        localStorage.setItem("__dcgs_snap_y", String(val));
        try { chrome.storage.local.set({ dashcraftGridSnapY: val }); } catch(_) {}
    },
    resetRotationInput: (input) => { input.value = gridSnap.rotation; },
    setRotation: (input) => {
        if (!input || !input.value) return;
        let val = gridSnap.clamp(input.value, 1, 359);
        gridSnap.rotation = val;
        localStorage.setItem("__dcgs_rotation_step", String(val));
        try { chrome.storage.local.set({ dashcraftGridSnapRotation: val }); } catch(_) {}
    },
    blurRotation: (input) => {
        if (!input) return;
        let val = gridSnap.clamp(input.value, 1, 359);
        gridSnap.rotation = val;
        input.value = val;
        localStorage.setItem("__dcgs_rotation_step", String(val));
        try { chrome.storage.local.set({ dashcraftGridSnapRotation: val }); } catch(_) {}
    }
};
// ==========================================
// 3. DASHCRAFT TOOLS CORE MOD LOGIC
// ==========================================
let rmc = {
    timeLimit: 600,
    active: false,
    verifieds: true,
    ids: [],
    trackId: null,
    trackLb: {},
    trackStarted: false,
    pbTime: Infinity,
    pbPos: Infinity,
    posNeeded: 0,
    gold: 0,
    paused: true,
    menu: {
        reset: (button) => {
            rmc.menu.active = false;
            button.classList.add("toggleButton");
        },
        toggle: (button) => {
            rmc.menu.active = !rmc.menu.active;
            button.classList.toggle("enabled", rmc.menu.active);
            rmc.menu.element.hidden = !rmc.menu.active;
        },
        active: false
    },
    timer: {
        paused: true,
        startTime: null,
        pauseTime: 0,
        pauseStart: null,
        start: () => {
            rmc.timer.startTime = Date.now(); 
            rmc.timer.paused = false;
            rmc.timer.pauseTime = 0;
            requestAnimationFrame(rmc.timer.update);
        },
        pause: () => {
            if (!rmc.timer.paused) {
                rmc.timer.pauseStart = Date.now(); 
                rmc.timer.paused = true;
            }
        },
        resume: () => {
            if (rmc.timer.paused) {
                rmc.timer.pauseTime += Date.now() - rmc.timer.pauseStart;
                rmc.timer.paused = false;
            }
        },
        getTime: () => {
            if (rmc.timer.paused) {
                return rmc.timer.pauseStart - rmc.timer.startTime - rmc.timer.pauseTime;
            } else {
                return Date.now() - rmc.timer.startTime - rmc.timer.pauseTime;
            }
        },
        update: () => {
            let time = rmc.timeLimit * 1000 - rmc.timer.getTime();
            let ms = time % 1000;
            let seconds = Math.floor((time / 1000) % 60);
            let minutes = Math.floor(time / 60000);
            rmc.menu.timer.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0').slice(0,2)}`;
            requestAnimationFrame(rmc.timer.update);
        }
    },
    fetchIds: async () => {
        let finished = false;
        let ids = [];
        const batchSize = 2500;
        let numFetched = 0;
        for (let outer = 0; !finished; outer++) {
            let fetches = [];
            for (let inner = 0; inner < batchSize / 50; inner++) {
                const page = outer * (batchSize / 50) + inner;
                fetches.push(fetch(`https://api.dashcraft.io/trackv2/global3?sort=new&verifiedOnly=${rmc.verifieds}&page=${page}&pageSize=50`)
                    .then(response => response.json())
                    .then(data => {
                        numFetched += data.tracks.length;
                        rmc.menu.statusIndicator.innerText = `Status: Fetching tracks (${numFetched})`;
                        if (data.tracks.length < 50) {
                            finished = true;
                        }
                        return data.tracks.map(track => track._id);
                    })
                );
            }
            ids = ids.concat((await Promise.all(fetches)).flat());
        }
        rmc.menu.statusIndicator.innerText = "Status: Idle";
        return ids;
    },
    start: async (button) => {
        if (!rmc.active) {
            button.innerText = "Stop RMC";
            rmc.ids = await rmc.fetchIds();
            rmc.active = true;
            rmc.timer.start();
            rmc.nextTrack();
        } else {
            button.innerText = "Start RMC";
            rmc.active = false;
            rmc.menu.statusIndicator.innerText = "Status: Not started";
        }
    },
    nextTrack: async() => {
        rmc.trackStarted = false;
        rmc.timer.pause();
        rmc.menu.statusIndicator.innerText = "Status: Picking next track";
        rmc.trackId = rmc.ids[Math.floor(Math.random() * rmc.ids.length)];
        console.log(`[DashCraft Tools] Next track: ${rmc.trackId}`);
        rmc.trackLb = await realFetch(`https://api.dashcraft.io/trackv2/${rmc.trackId}/leaderboard`)
            .then(response => response.json());
        
        rmc.posNeeded = Math.floor(rmc.trackLb.totalEntries / 10);
        if (rmc.trackLb.leaderboard.length == 0 || rmc.trackLb.leaderboard[Math.min(rmc.posNeeded, 9)].time >= 60) {
            rmc.nextTrack();
            return;
        }
        let timeNeeded = rmc.posNeeded > 9 ? null : rmc.trackLb.leaderboard[rmc.posNeeded].time;
        rmc.gold = Math.ceil((timeNeeded == null ? rmc.trackLb.leaderboard[9].time : timeNeeded) * 1.06);
        rmc.menu.requirements.innerHTML = `Position Needed: ${rmc.posNeeded + 1} ${timeNeeded == null ? "" : `(${timeNeeded.toFixed(2)}s)`}<br>Gold Time: ${rmc.gold.toFixed(2)}s`;
        rmc.menu.statusIndicator.innerText = "Status: Waiting for track start";
    }
};

let testInput;
let jsonEditor = {
    public: {
        reset: (button) => {
            button.classList.add("toggleButton");
            button.classList.toggle("enabled", jsonEditor.public.force);
        },
        force: false,
        toggle: (button) => {
            jsonEditor.public.force = !jsonEditor.public.force;
            button.classList.toggle("enabled", jsonEditor.public.force);
        }
    },
    linkCps: {
        reset: (button) => {
            button.classList.add("toggleButton");
            button.classList.toggle("enabled", jsonEditor.linkCps.linkAll);
        },
        linkAll: false,
        toggle: (button) => {
            jsonEditor.linkCps.linkAll = !jsonEditor.linkCps.linkAll;
            button.classList.toggle("enabled", jsonEditor.linkCps.linkAll);
        }
    },
    forceNew: {
        button: null,
        value: false,
        reset: (button) => {
            jsonEditor.forceNew.button = button;
            jsonEditor.forceNew.value = false;
            button.classList.add("toggleButton");
            button.classList.toggle("enabled", jsonEditor.forceNew.value);
        },
        toggle: (button) => {
            jsonEditor.forceNew.value = !jsonEditor.forceNew.value;
            (button || jsonEditor.forceNew.button).classList.toggle("enabled", jsonEditor.forceNew.value);
        }
    },
    trackData: {
        resetToggle: (button) => {
            jsonEditor.trackData.override = localStorage.getItem("trackDataToggle") === "true";
            button.classList.add("toggleButton");
            button.classList.toggle("enabled", jsonEditor.trackData.override);
        },
        resetInput: (input, container) => {
            jsonEditor.trackData.input = localStorage.getItem("trackDataInput");
            input.value = jsonEditor.trackData.input;
            container.classList.add("validCheck");
            jsonEditor.trackData.update(input, container);
        },
        override: false,
        toggle: (button) => {
            jsonEditor.trackData.override = !jsonEditor.trackData.override;
            button.classList.toggle("enabled", jsonEditor.trackData.override);
            localStorage.setItem("trackDataToggle", jsonEditor.trackData.override);
        },
        input: null,
        stored: null,
        update: (input, container) => {
            jsonEditor.trackData.input = input.value;
            localStorage.setItem("trackDataInput", input.value);
            const value = input.value.trim();
            if (/^https:\/\/dashcraft.io\/?\?t=[0-9a-f]{24}$/.test(input.value)) {
                let id = input.value.slice(-24);
                realFetch(`https://cdn.dashcraft.io/v2/prod/track/${id}.json?random=${Math.random()}`)
                    .then(response => response.json())
                    .catch(error => {
                        jsonEditor.trackData.stored = null;
                        container.classList.add("invalid");
                        return;
                    })
                    .then(data => {
                        if (!data) return;
                        container.classList.remove("invalid");
                        jsonEditor.trackData.createInstructions();
                        jsonEditor.trackData.stored = data;
                        realFetch(`https://api.dashcraft.io/trackv2/${id}`)
                            .then(response => response.json())
                            .then(data => {
                                jsonEditor.trackData.stored.screenshotCameraPosition = data.screenshotCameraPosition;
                            });
                    });
            } else {
                try {
                    const inputJson = JSON.parse(value);
                    if (inputJson.hasOwnProperty("trackPieces")) {
                        jsonEditor.trackData.stored = inputJson;
                    } else {
                        jsonEditor.trackData.stored = {trackPieces: inputJson};
                    };
                    container.classList.remove("invalid");
                    jsonEditor.trackData.createInstructions();
                } catch (e) {
                    console.log("[DashCraft Tools] ", e);
                    jsonEditor.trackData.stored = null;
                    container.classList.add("invalid");
                }
            }
        },
        instructionMenu: {
            parent: null,
            children: []
        },
        createInstructions: () => {
            if (!jsonEditor.trackData.instructionMenu.parent || !jsonEditor.trackData.stored) return;
            let instructions = getInstructions(jsonEditor.trackData.stored.trackPieces);
            for (let i = 0; i < jsonEditor.trackData.instructionMenu.children.length; i++) {
                jsonEditor.trackData.instructionMenu.children[i].remove();
            }
            instructions.forEach(instruction => {
                let facing = ["+Z", "+X", "-Z", "-X"][instruction.a[3]];
                let label = createLabel(`${instruction.count} at ${instruction.a.slice(0, 3).join(", ")} facing ${facing}`);
                jsonEditor.trackData.instructionMenu.children.push(label);
                jsonEditor.trackData.instructionMenu.parent.appendChild(label);
            });
        }
    },
};

let misc = {
    pageSize: {
        value: null,
        resetButton: (toggle) => {
            misc.pageSize.override = localStorage.getItem("pageSizeToggle") === "true";
            toggle.classList.add("toggleButton");
            toggle.classList.toggle("enabled", misc.pageSize.override);
        },
        resetInput: (input) => {
            misc.pageSize.value = parseInt(localStorage.getItem("pageSize"), 10);
            input.value = misc.pageSize.value;
        },
        set: (input) => {
            try {
                misc.pageSize.value = parseInt(input.value, 10);
                misc.pageSize.value = Math.min(Math.max(input.value, 15), 50);
            } catch {
                misc.pageSize.value = null;
            }
            localStorage.setItem("pageSize", misc.pageSize.value);
        },
        blur: (input) => {
            input.value = misc.pageSize.value;
        },
        override: false,
        toggle: (button) => {
            misc.pageSize.override = !misc.pageSize.override;
            button.classList.toggle("enabled", misc.pageSize.override);
            localStorage.setItem("pageSizeToggle", misc.pageSize.override);
        }
    },
    thumbnailData: {
        position: {
            reset: (button) => {
                misc.thumbnailData.position.enabled = localStorage.getItem("thumbnailPosition") === "true";
                button.classList.add("toggleButton");
                button.classList.toggle("enabled", misc.thumbnailData.position.enabled);
            },
            enabled: false,
            toggle: (button) => {
                misc.thumbnailData.position.enabled = !misc.thumbnailData.position.enabled;
                button.classList.toggle("enabled", misc.thumbnailData.position.enabled);
                localStorage.setItem("thumbnailPosition", misc.thumbnailData.position.enabled);
            }
        },
    },
    openInEditor: {
        input: null,
        valid: false,
        reset: (input, container) => {
            misc.openInEditor.input = localStorage.getItem("openInEditorURL") || null;
            input.value = misc.openInEditor.input;
            container.classList.add("validCheck");
            misc.openInEditor.set(input, container);
        },
        set: (input, container) => {
            misc.openInEditor.input = input.value;
            misc.openInEditor.valid = false;
            localStorage.setItem("openInEditorInput", misc.openInEditor.input);
            if (/^https:\/\/dashcraft.io\/?\?t=[0-9a-f]{24}$/.test(misc.openInEditor.input)) {
                let id = misc.openInEditor.input.slice(-24);
                realFetch(`https://cdn.dashcraft.io/v2/prod/track/${id}.json`)
                    .then(response => response.json())
                    .catch(error => {
                        container.classList.add("invalid");
                    })
                    .then(data => {
                        misc.openInEditor.valid = true;
                        container.classList.remove("invalid");
                    });
            } else {
                container.classList.add("invalid");
            }
        }
    }
};

let accountSwitcher = {
    autoAdd: {
        reset: (button) => {
            accountSwitcher.autoAdd.value = localStorage.getItem("autoAdd") === "true";
            button.classList.add("toggleButton");
            button.classList.toggle("enabled", accountSwitcher.autoAdd.value);
        },
        value: false,
        toggle: (button) => {
            accountSwitcher.autoAdd.value = !accountSwitcher.autoAdd.value;
            button.classList.toggle("enabled", accountSwitcher.autoAdd.value);
            localStorage.setItem("autoAdd", accountSwitcher.autoAdd.value);
        }
    },
    menu: null,
    options: [],
    mode: 0,
    resetTokens: (hoverButton, menu) => {
        accountSwitcher.menu = menu;
        accountSwitcher.options = [];
        const tempTokens = JSON.parse(localStorage.getItem("tokens"));
        if (!tempTokens) return;
        tokens = [];
        for (let i = 0; i < tempTokens.length; i++) {
            accountSwitcher.addToken(tempTokens[i]);
        }
    },
    cycleMode: (button) => {
        accountSwitcher.mode = (accountSwitcher.mode + 1) % 4;
        button.innerText = ["Sign In", "Remove", "Copy", "Copy As Bookmark"][accountSwitcher.mode];
    },
    addToken: (token) => {
        if (!tokens.includes(token)) {
            realFetch("https://api.dashcraft.io/auth/account", {headers: {Authorization: token}})
                .then(response => response.json())
                .then(data => {
                    if (data.username && !tokens.includes(token)) {
                        tokens.push(token);
                        localStorage.setItem("tokens", JSON.stringify(tokens));
                        let button = createButton(data.username);
                        button.addEventListener("click", () => {
                            if (accountSwitcher.mode == 0) {
                                var request = indexedDB.open("/idbfs");
                                request.onsuccess = function(event) {
                                    var db = event.target.result;
                                    var transaction = db.transaction("FILE_DATA", "readwrite");
                                    var objectStore = transaction.objectStore("FILE_DATA");
                                    var storeName = "/idbfs/a4cde6f7db08abc1da0fa04a69529237/PlayerPrefs";
                                    objectStore.get(storeName).onsuccess = function(event) {
                                        var textEncoder = new TextEncoder("utf-8");
                                        var oldContent = event.target.result;
                                        var text = Array.from(oldContent.contents);
                                        var updatedBytes = textEncoder.encode(token);
                                        var DECODED = (new TextDecoder("utf-8")).decode(new Uint8Array(text));
                                        var startIndex = DECODED.indexOf("eyJ");
                                        var endIndex = startIndex + 172;
                                        text.splice(startIndex, 172, ...updatedBytes);
                                        var modifiedText = new Uint8Array(text);
                                        oldContent.contents = modifiedText;
                                        var RQ = objectStore.put(oldContent, storeName);
                                        RQ.onsuccess = (event) => {
                                            location.reload();
                                        };
                                    };
                                };
                            } else if (accountSwitcher.mode == 1) {
                                button.remove();
                                tokens = tokens.filter(t => t != token);
                                localStorage.setItem("tokens", JSON.stringify(tokens));
                            } else if (accountSwitcher.mode == 2) {
                                navigator.clipboard.writeText(token);
                            } else if (accountSwitcher.mode == 3) {
                                navigator.clipboard.writeText(`javascript: var newToken = "${token}"; var request = indexedDB.open("/idbfs"); request.onsuccess = function(event) { var db = event.target.result; var transaction = db.transaction("FILE_DATA", "readwrite"); var objectStore = transaction.objectStore("FILE_DATA"); var storeName = "/idbfs/a4cde6f7db08abc1da0fa04a69529237/PlayerPrefs"; objectStore.get(storeName).onsuccess = function(event) { var textEncoder = new TextEncoder("utf-8"); var oldContent = event.target.result; text = Array.from(oldContent.contents); var yourNewText = newToken; console.log("[DashCraft Tools] Your new text: ", yourNewText); var updatedBytes = textEncoder.encode(yourNewText); var DECODED = (new TextDecoder("utf-8")).decode(new Uint8Array(text)); var startIndex = DECODED.indexOf("eyJ"); var endIndex = startIndex + 172; console.log("[DashCraft Tools] ", updatedBytes); text.splice(startIndex, 172, ...updatedBytes); var modifiedText = new Uint8Array(text); console.log("[DashCraft Tools] ",modifiedText); oldContent.contents = modifiedText; var RQ = objectStore.put(oldContent, storeName); RQ.onsuccess = (event) => {location.reload()};}; };`);
                            }
                        });
                        accountSwitcher.menu.appendChild(button);
                    }
                });
        }
    },
    copyAllToClipboard: () => {
        navigator.clipboard.writeText(tokens.join(", "));
    },
    addFromClipboard: () => {
        navigator.clipboard.readText()
            .then(text => {
                let newTokens = text.split("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.").slice(1).map(t => `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${t.slice(0, 135)}`).filter(t => t.length == 172);
                for (let i = 0; i < newTokens.length; i++) {
                    accountSwitcher.addToken(newTokens[i]);
                }
            });
    }
};

let currentToken;
let tokens = [];

// Stop Unity from eating keyboard events when focused on input fields
const originalAddEventListener = EventTarget.prototype.addEventListener;
EventTarget.prototype.addEventListener = function (type, listener, options) {
    if ((type === 'keydown' || type === 'keypress' || type === 'keyup') && typeof listener === 'function') {
        const wrapped = function (event) {
            const active = document.activeElement;
            if (active && active.tagName === "INPUT") {
                return;
            }
            return listener.call(this, event);
        };
        return originalAddEventListener.call(this, type, wrapped, options);
    }
    return originalAddEventListener.call(this, type, listener, options);
};

function editThumbnail(image, id) {   
    return new Promise(resolve => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const canvasImage = new Image();
        const imageURL = URL.createObjectURL(image);
        canvasImage.src = imageURL;
        canvasImage.onload = () => {
            canvas.width = canvasImage.width;
            canvas.height = canvasImage.height;
            ctx.drawImage(canvasImage, 0, 0);
            URL.revokeObjectURL(imageURL);

            const right = 183;
            ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
            ctx.roundRect(8, 218, right-8, 56, 19);
            ctx.fill();

            ctx.fillStyle = "rgb(255, 255, 255)";
            ctx.fillRect(right-44-15, 241, 10, 20);
            ctx.fillRect(right-29-15, 231, 10, 30);
            ctx.fillRect(right-14-15, 246, 10, 15);

            realFetch(`https://api.dashcraft.io/trackv2/${id}/leaderboard`, {headers: {Authorization: currentToken}})
                .then(response => response.json())
                .then(data => {
                    ctx.scale(1.4, 1);
                    ctx.font = "bold 32px Trebuchet MS";
                    ctx.textAlign = "right";
                    
                    if (data.hasOwnProperty("myBest")) {
                        ctx.fillText(data.myBest.place + 1, (right-69)/1.4, 257);
                    } else {
                        ctx.fillText("N/A", (right-69)/1.4, 257);
                    }

                    canvas.toBlob((blob) => {
                        canvas.remove();
                        resolve(blob);
                    }, "image/jpeg", 0.9);
                });
        };
    });
}

// Global Toggle UI state
let menus = document.getElementsByClassName("modMenu");
let active = false;
document.addEventListener("keydown", function(event) {
    if (event.key === "Tab") {
        event.preventDefault();
        active = !active;
        for (let menu of menus) {
            if (!menu.classList.contains("persistent")) {
                menu.classList.toggle("inactive", !active);
            }
        }
    }
});

function createMenu(title, index = 0) {
    let menu = document.createElement("div");
    menu.style.left = `${index * 11 + 1}vw`;
    menu.style.zIndex = -index;
    menu.classList.add("modMenu", "inactive");

    let label = document.createElement("div");
    label.innerText = title;
    label.classList.add("label");
    menu.appendChild(label);

    return menu;
}

function createSplitRow(a, b) {
    a.classList.add("leftSide");
    let ac = document.createElement("div");
    ac.classList.add("halfWidth", "container", "leftSide");
    ac.appendChild(a);

    let bc = document.createElement("div");
    bc.classList.add("halfWidth", "container");
    bc.appendChild(b);

    let container = document.createElement("div");
    container.classList.add("container");
    container.appendChild(ac);
    container.appendChild(bc);

    return container;
}

function createButton(text, startCallback = () => {}, callback = () => {}) {
    let button = document.createElement("button");
    button.innerText = text;
    startCallback(button);
    button.addEventListener("click", callback.bind(null, button));
    return button;
}

function createInput(placeholder, type, startCallback = () => {}, callback = () => {}, blurCallback = () => {}) {
    let input = document.createElement("input");
    input.placeholder = placeholder;
    input.type = type;
    input.classList.add("modInput");

    let container = document.createElement("div");
    container.classList.add("container");
    container.appendChild(input);
    testInput = container;

    startCallback(input, container);

    input.addEventListener("input", () => callback(input, container));
    input.addEventListener("blur", () => blurCallback(input, container));
    return container;
}

function createSideMenu(text, callback = () => {}, startCallback = () => {}) {
    let hoverButton = document.createElement("button");
    hoverButton.classList.add("hoverButton");
    let textContainer = document.createElement("div");
    textContainer.innerText = text;
    hoverButton.appendChild(textContainer);
    let menu = document.createElement("div");
    menu.classList.add("sideMenu");
    menu.hidden = true;
    hoverButton.appendChild(menu);
    let onPopup = false;
    menu.addEventListener("mouseenter", () => {onPopup = true;});
    menu.addEventListener("mouseleave", () => {onPopup = false;});
    hoverButton.addEventListener("click", () => {
        if (!onPopup) {
            callback(textContainer);
        }
    });
    hoverButton.addEventListener("mouseenter", () => {menu.hidden = false;});
    hoverButton.addEventListener("mouseleave", () => {menu.hidden = true;});
    startCallback(hoverButton, menu);
    return hoverButton;
}

function createFileInput(text, type, callback) {
    let input = document.createElement("input");
    input.type = "file";
    input.accept = type;                        

    input.addEventListener("change", (event) => {
        if (event.target.files.length > 0) {
            callback(event.target.files[0]);
        }
    });
    
    let button = createButton(text, () => input.click());
    button.appendChild(input);
    
    return button;
}

function createLabel(text, className = "normalLabel") {
    let div = document.createElement("div");
    div.classList.add(className);
    div.innerHTML = text;
    return div;
}

// Construct Mod UI on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    const menuWidth = 10;
    const menuHeight = 20;
    let css = document.createElement("style");

    css.innerHTML = `
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }

        input[type=number] {
            -moz-appearance: textfield;
        }

        #modLayer {
            position: absolute;
            top: 0;
            left: 0;
            z-index: 100000;
            width: 100%;
            height: 100%;
            pointer-events: none;
            font-size: 0.75vw;
        }
        .modMenu {
            position: absolute;
            top: 1vw;
            width: ${menuWidth}vw;
            height: ${menuHeight}vw;
            border-radius: 0.5vw;
            background: rgb(43, 43, 43);
            pointer-events: auto;
            transition: transform 0.1s ease-in-out;
        }

        ::after {
            pointer-events: none;
        }

        .modMenu * {
            position: relative;
        }
        .label {
            background-color: rgb(216, 84, 84);
            width: 100%;
            height: 2vw;
            border-radius: 0.5vw 0.5vw 0 0;
            text-align: center;
            align-content: center;
            font-size: 1vw;
            margin-bottom: 0.25vw;
        }
        .inactive {
            transform: translateY(calc(-100% - 1vw));
        }

.container {
            margin: 0;
            padding: 0;
            display: flex;
            align-items: center;
            width: 100%;
        }

        .halfWidth {
            width: 50%;
            display: flex;
            align-items: center;
        }
        .normalLabel {
            width: calc(100% - 0.5vw);
            height: 1vw;
            color: white;
            font-size: 0.75vw;
            text-align: left;
            padding: 0.25vw;
        }
        .smallLabel {
            width: calc(100% - 0.5vw);
            height: 1vw;
            color: rgb(200, 200, 200);
            font-size: 0.55vw;
            text-align: center;
            padding: 0.25vw;
        }
        
        .modMenu button {
            width: 100%;
            height: 1.5vw;
            background-color: rgba(0, 0, 0, 0);
            border-width: 0;
            color: white;
            font-size: 0.75vw;
            text-align: left;
        }

        .hoverButton::after {
            content: "";
            position: absolute;
            right: 0.5vw;
            top: 0.75vw;
            transform: translateY(-50%);
            border-width: 0.7vw 0.7vw 0 0;
            border-style: solid;
            border-color: transparent rgba(255, 255, 255, 0.2) transparent transparent;
        }

        .modMenu button.enabled {
            color: rgb(216, 84, 84);
        }
        .modMenu button:hover {
            background-color: rgba(0, 0, 0, 0.2);
        }
        
        .toggleButton::after {
            content: "";
            position: absolute;
            right: 0.2vw;
            top: 0.2vw;
            width: 0.2vw;
            height: 1.1vw;
            background-color: rgba(255, 255, 255, 0.2);
        }
        .toggleButton.enabled::after {
            background-color: rgb(216, 84, 84);
        }

        .modMenu *:focus {
            outline: none;
        }
        .modMenu input {
            width: calc(100% - 0.5vw);
            height: 1vw;
            margin: 0.125vw;
            padding: 0.125vw;
            background-color: rgba(0, 0, 0, 0.2);
            border: none;
            color: white;
            font-size: 0.75vw;
        }

        .validCheck::after {
            content: "";
            position: absolute;
            right: 0.4vw;
            top: 0.4vw;
            width: 0.7vw;
            height: 0.7vw;
            background-color: rgba(115, 216, 84, 1);
            border-radius: 50%;
        }

        .invalid::after {
            background-color: rgb(216, 84, 84);
        }

        .hoverButton {
            position: relative;
        }

        .sideMenu {
            position: absolute;
            min-height: 1.5vw;
            top: 0;
            left: 100%;
            width: ${menuWidth}vw;
            background-color: rgb(43, 43, 43);
        }

        .leftSide {
            text-align: right;
        }
    `;
    document.head.appendChild(css);

    let modLayer = document.createElement("div");
    modLayer.id = "modLayer";

    // 0: Miscellaneous Menu
    let miscMenu = createMenu("Miscellaneous", 0);
    miscMenu.appendChild(createSplitRow(
        createButton("Page Size", misc.pageSize.resetButton, misc.pageSize.toggle),
        createInput("", "number", misc.pageSize.resetInput, misc.pageSize.set, misc.pageSize.blur)
    ));
    miscMenu.appendChild(createButton("Position in Thumbnail", misc.thumbnailData.position.reset, misc.thumbnailData.position.toggle));
    miscMenu.appendChild(createInput("Open In Editor", "text", misc.openInEditor.reset, misc.openInEditor.set));

    // 1: Track Editor Menu
    let jsonMenu = createMenu("Track Editor", 1);
    jsonMenu.appendChild(createButton("Force Public", jsonEditor.public.reset, jsonEditor.public.toggle));
    jsonMenu.appendChild(createButton("Link All Checkpoints", jsonEditor.linkCps.reset, jsonEditor.linkCps.toggle));
    jsonMenu.appendChild(createButton("Force New Track", jsonEditor.forceNew.reset, jsonEditor.forceNew.toggle));
    jsonMenu.appendChild(createButton("Override Pieces", jsonEditor.trackData.resetToggle, jsonEditor.trackData.toggle));
    jsonMenu.appendChild(createInput("Link or JSON", "text", jsonEditor.trackData.resetInput, jsonEditor.trackData.update));

    // 2: RMC Settings Menu
    let rmcMenu = createMenu("RMC Settings", 2);
    rmcMenu.appendChild(createButton("Toggle Menu", rmc.menu.reset, rmc.menu.toggle));
    rmc.menu.element = document.createElement("div");
    rmc.menu.element.classList.add("modMenu", "persistent");
    rmc.menu.element.appendChild(document.createElement("br"));
    rmc.menu.element.appendChild(createButton("Start RMC", undefined, rmc.start));
    rmc.menu.statusIndicator = createLabel("Status: Not started");
    rmc.menu.element.appendChild(rmc.menu.statusIndicator);
    rmc.menu.requirements = createLabel("Position Needed: N/A<br>Gold Time: N/A");
    rmc.menu.element.appendChild(rmc.menu.requirements);
    rmc.menu.timer = createLabel("10:00.00");
    rmc.menu.timer.style.fontFamily = "monospace"; 
    rmc.menu.element.appendChild(rmc.menu.timer);
    rmc.menu.element.style.right = `1vw`;
    rmc.menu.element.style.width = `15vw`;
    rmc.menu.element.style.top = `calc(50vh - ${menuHeight/2}vw)`;
    rmc.menu.element.hidden = true;

    // 3: Accounts Menu
    let accountMenu = createMenu("Accounts", 3);
    accountMenu.appendChild(createButton("Auto Add Accounts", accountSwitcher.autoAdd.reset, accountSwitcher.autoAdd.toggle));
    accountMenu.appendChild(createSideMenu("Sign In", accountSwitcher.cycleMode, accountSwitcher.resetTokens));
    accountMenu.appendChild(createSplitRow(
        createButton("Copy All", undefined, accountSwitcher.copyAllToClipboard),
        createButton("Paste", undefined, accountSwitcher.addFromClipboard)
    ));

// 4: Integrated Grid Snap Menu (SnapSickle)
    let snapMenu = createMenu("Editor Grid Snap", 4);
    snapMenu.appendChild(createSplitRow(
        createLabel("X/Z Snap"),
        createInput("15", "number", gridSnap.resetXZInput, gridSnap.setXZ, gridSnap.blurXZ)
    ));
    snapMenu.appendChild(createSplitRow(
        createLabel("Y Snap"),
        createInput("15", "number", gridSnap.resetYInput, gridSnap.setY, gridSnap.blurY)
    ));
    snapMenu.appendChild(createSplitRow(
        createLabel("Rotation (°)"),
        createInput("90", "number", gridSnap.resetRotationInput, gridSnap.setRotation, gridSnap.blurRotation)
    ));
    snapMenu.appendChild(createLabel("<em>Reload game to apply snap changes.</em>", "smallLabel"));

    modLayer.appendChild(miscMenu);
    modLayer.appendChild(jsonMenu);
    modLayer.appendChild(rmcMenu);
    modLayer.appendChild(accountMenu);
    modLayer.appendChild(snapMenu);
    modLayer.appendChild(rmc.menu.element);
    document.body.appendChild(modLayer);
});

// Helper Functions for Data Processing
function fixData(data, original) {
    data = structuredClone(data);
    let totals = {p: [0, 0, 0], r: 0};
    for (let i = 0; i < original.length; i++) {
        totals.p = totals.p.map((p, index) => p + original[i].p[index]);
        totals.r += original[i].r;
    }
    for (let i = 0; i < data.length; i++) {
        totals.p = totals.p.map((p, index) => p - data[i].p[index]);
        totals.r -= data[i].r;
    }
    if (totals.p[0] != 0 || totals.p[1] != 0 || totals.p[2] != 0 || totals.r != 0) {
        data.push({id: 29, uid: 1000000, p: totals.p, r: totals.r, a: []});
    }
    if (data.length > original.length) {
        return null;
    }
    while (data.length < original.length) {
        data.push({id: 29, uid: 1000001, p: [0, 0, 0], r: 0, a: []});
    }
    return data;
}

async function splitBlobByTextRange(blob, textStartMarker, textEndMarker) {
    const buffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    const decoder = new TextDecoder("utf-8");
    function indexOfSequence(source, target, fromIndex = 0) {
        const targetLen = target.length;
        if (targetLen === 0) return -1;
        const limit = source.length - targetLen;
        for (let i = fromIndex; i <= limit; i++) {
            if (source[i] === target[0]) {
                let j = 1;
                while (j < targetLen && source[i + j] === target[j]) j++;
                if (j === targetLen) return i;
            }
        }
        return -1;
    }
    const encoder = new TextEncoder();
    const startBytes = encoder.encode(textStartMarker);
    const endBytes = encoder.encode(textEndMarker);

    const startIndex = indexOfSequence(uint8, startBytes);
    if (startIndex === -1) throw new Error("Start marker not found in blob");
    const markerIndex = indexOfSequence(uint8, endBytes, startIndex);
    if (markerIndex === -1) throw new Error("End marker not found in blob");

    const searchStart = markerIndex + endBytes.length;
    const closingBraceByte = 125;
    const endIndex = uint8.indexOf(closingBraceByte, searchStart);
    if (endIndex === -1) throw new Error("Closing brace not found in blob");

    const textEndIndex = endIndex + 1;
    const beforeTextBuffer = buffer.slice(0, startIndex);
    const textPartBuffer = buffer.slice(startIndex, textEndIndex);
    const afterTextBuffer = buffer.slice(textEndIndex);
    const decodedText = decoder.decode(textPartBuffer);

    return [beforeTextBuffer, decodedText, afterTextBuffer];
}

function rejoinBlob(parts) {
    return new Blob([
        parts[0],
        new TextEncoder().encode(parts[1]),
        parts[2]
    ]);
}

function getTotalPos(pieces) {
    let totals = [0, 0, 0];
    for (let i = 0; i < pieces.length; i++) {
        totals = totals.map((p, index) => p + pieces[i].p[index]);
    }
    return totals;
}

function getTotalRot(pieces) {
    let total = 0;
    for (let i = 0; i < pieces.length; i++) {
        total += pieces[i].r;
    }
    return total;
}

function getRemaining(total, instructions) {
    for (let i = 0; i < instructions.length; i++) {
        total = total.map((t, index) => t - instructions[i].a[index] * instructions[i].count);
    }
    return total;
}

function getInstructions(pieces) {
    let instructions = [];
    let total = [...getTotalPos(pieces), getTotalRot(pieces)];
    let remaining;
    
    let range = [[-750, 750], [0, 1500], [-750, 750], [0, 270]];
    let increment = [15, 15, 15, 90];
    for (let i = 0; i < pieces.length; i++) {
        if (i != 0) instructions[instructions.length - 1].count++;
        remaining = getRemaining(total, instructions);    
        if (i == 0 ||!remaining.every((r, index) => (Math.abs(r)) <= (pieces.length - i - 1) * Math.abs(range[index][(r > 0) ? 1 : 0]))) {
            if (i != 0) instructions[instructions.length - 1].count--;
            remaining = getRemaining(total, instructions);
            let average = remaining.map(a => a / (pieces.length - i));
            let instruction = average.map((a, index) => Math.round(a / increment[index]) * increment[index]);
            instructions.push({a: instruction, count: 1});
        }
    }
    instructions = instructions.map(instruction => {return {a: instruction.a.map((a, index) => a / increment[index]), count: instruction.count};});
    return instructions;
}

// ==========================================
// 4. OVERRIDDEN FETCH HANDLER
// ==========================================
const realFetch = window.fetch;
window.fetch = (url, options) => {

    // Extract authorization tokens
    if (options && options.headers && options.headers.Authorization) {
        currentToken = options.headers.Authorization;
        if (accountSwitcher.autoAdd.value) {
            accountSwitcher.addToken(currentToken);
        }
    }

    // Override page size
    if (misc.pageSize.override && url.length) {
        url = url.replace("pageSize=15", `pageSize=${misc.pageSize.value}`);
    }

    // Bugfix: private saved tracks (always on)
    if (/^https:\/\/api\.dashcraft\.io\/trackv2\/saved\?page=\d+&pageSize=\d{1,2}$/.test(url)) {
        return new Promise(resolve => {
            realFetch(url, options)
            .then(response => response.json())
            .then(data => {
                data.tracks = data.tracks.map(track => {track.isPublic = true; return track;});
                console.log("[DashCraft Tools] ", data.tracks);
                const modifiedResponse = new Response(JSON.stringify(data));
                resolve(modifiedResponse);
            });
        });
    }

    // RMC logic
    if (rmc.active) {
        if (/^https:\/\/api\.dashcraft\.io\/trackv2\/[0-9a-f]{24}\/finish$/.test(url)) {
            const response = realFetch(url, options);

            response
                .then(response => response.clone().json())
                .then(data => {
                    if (data.currentTime < rmc.pbTime) {
                        rmc.pbTime = data.currentTime;
                        rmc.pbPos = data.currentPlace;
                        if (rmc.pbPos <= rmc.posNeeded) {
                            rmc.nextTrack();
                        }
                    }
                });

            return response;
        }

        if (url == "https://api.dashcraft.io/trackv2/random?lean=true") {
            if (Object.keys(rmc.trackLb).length == 0) return null;
            rmc.randomPressed = true;

            return new Promise(resolve => {
                realFetch(url, options)
                    .then(response => Promise.all([response, response.json()]))
                    .then(([response, data]) => {
                        data._id = rmc.trackId;
                        resolve(new Response(JSON.stringify(data)), response);
                    });
            });
        }

        if (url == `https://api.dashcraft.io/trackv2/${rmc.trackId}/leaderboard`) {
            let response = realFetch(url, options);

            response.then(response => response.clone().json())
                .then(data => {
                    rmc.trackStarted = true;
                    rmc.timer.resume();
                    rmc.menu.statusIndicator.innerText = "Status: Running";
                });

            return response;
        }
    }

    // Add data to thumbnail
    if (misc.thumbnailData.position.enabled && /^https:\/\/cdn\.dashcraft\.io\/v2\/prod\/track-thumbnail\/sm\/[0-9a-f]{24}\.jpg\?v=\d+$/.test(url)) {
        return new Promise(resolve => {
            realFetch(url, options)
                .then(response => Promise.all([response, response.blob()]))
                .then(([response, blob]) => {
                    const id = url.match(/[0-9a-f]{24}/)[0];
                    const newImage = editThumbnail(blob, id);
                    return Promise.all([response, newImage]);
                })
                .then(([response, image]) => resolve(new Response(image, response)));
        });
    }

    // Open in editor
    if (misc.openInEditor.valid && /https:\/\/api\.dashcraft\.io\/trackv2\/user\/private\?page=0&pageSize=\d{2}/.test(url)) {
        return new Promise(resolve => {
            realFetch(url, options)
            .then(response => response.json())
            .then(data => {
                data.tracks.splice(0, 0, {_id: misc.openInEditor.input.slice(-24)});
                const modifiedResponse = new Response(JSON.stringify(data));
                resolve(modifiedResponse);
            });
        });
    }

    // JSON editor manipulations
    if (/^https:\/\/api\.dashcraft\.io\/trackv2(\/update\/[0-9a-f]{24})?$/.test(url)) {
        if (jsonEditor.forceNew.value) {
            jsonEditor.forceNew.toggle();
            return new Promise(resolve => {
                resolve(new Response(""));
            });
        }
        if (jsonEditor.public.force || jsonEditor.trackData.override || jsonEditor.linkCps.linkAll) {
            return new Promise(resolve => {
                splitBlobByTextRange(options.body, '{', '"computedDifficulty":')
                    .then(data => {
                        let json = JSON.parse(data[1]);

                        if (jsonEditor.public.force) {
                            json.isPublic = true;
                        }

                        if (jsonEditor.linkCps.linkAll) {
                            json.computedLinkedCheckpoints = [json.trackPieces.map(piece => piece.uid)];
                        }

                        const storedData = jsonEditor.trackData.stored;
                        if (jsonEditor.trackData.override && storedData) {
                            let newPieces = fixData(storedData.trackPieces, json.trackPieces);
                            if (newPieces) {
                                json.trackPieces = newPieces;
                                if (storedData.hasOwnProperty("environmentId")) {
                                    json.environmentId = storedData.environmentId;
                                }
                                if (storedData.hasOwnProperty("computedLinkedCheckpoints")) {
                                    json.computedLinkedCheckpoints = storedData.computedLinkedCheckpoints;
                                }
                                if (storedData.hasOwnProperty("screenshotCameraPosition")) {
                                    json.screenshotCameraPosition = storedData.screenshotCameraPosition;
                                }
                            } else {
                                console.warn("[DashCraft Tools] Too few pieces in loaded track");
                            }
                        }

                        data[1] = JSON.stringify(json);
                        options.body = rejoinBlob(data);

                        return realFetch(url, options);
                    })
                    .then(response => resolve(response));
            });
        }
    }
    return realFetch(url, options);
};
