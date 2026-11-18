import { createCoinMotion, coinOutline } from "./coin-motion.mjs";
import { watchScene } from "./scene-loop.mjs";

const outlines = [0, 1, 2].map((i) => coinOutline(i));
const finishes = [
    { edge: "#e9becf", accent: "#ed386d", dark: "#54253d" },
    { edge: "#dbc4ff", accent: "#a275f4", dark: "#3b265c" },
    { edge: "#d6f4e6", accent: "#68c4a3", dark: "#204c43" }
];
function path(ctx, points, scale = 1) {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x * scale, y * scale) : ctx.moveTo(x * scale, y * scale));
    ctx.closePath();
}
function line(ctx, points) {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.stroke();
}
function glyph(ctx, symbol, material) {
    ctx.lineWidth = .035;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = material.edge;
    if (symbol === 0) {
        ctx.beginPath();ctx.arc(0, .15, .16, 0, Math.PI * 2);ctx.stroke();
        path(ctx, [[-.07,.025],[.07,.025],[.14,-.25],[-.14,-.25]]);ctx.fillStyle = "#11101b";ctx.fill();ctx.stroke();
    } else if (symbol === 1) {
        path(ctx, [[0,.34],[.29,.17],[.29,-.17],[0,-.34],[-.29,-.17],[-.29,.17]]);ctx.stroke();
        line(ctx,[[-.29,.17],[0,0],[.29,.17]]);line(ctx,[[0,0],[0,-.34]]);
    } else {
        path(ctx, [[0,.36],[.28,.25],[.26,-.06],[.18,-.24],[0,-.38],[-.18,-.24],[-.26,-.06],[-.28,.25]]);ctx.stroke();
        line(ctx,[[-.13,-.015],[-.035,-.12],[.15,.12]]);
    }
}
function brand(ctx, image) {
    const points = [[.23,.29],[.24,.25],[.28,.22],[.34,.21],[.585,.21],[.777,.401],[.78,.66],[.77,.72],[.73,.76],[.68,.78],[.35,.78],[.28,.76],[.24,.72],[.22,.66],[.22,.35]];
    ctx.save();
    ctx.scale(1, -1);
    path(ctx, points.map(([x,y]) => [(x-.5)*1.65,(y-.5)*1.65]));
    ctx.clip();
    ctx.drawImage(image, -.825, -.825, 1.65, 1.65);
    ctx.restore();
}

export function mountCanvasCoins(canvas, { brandImage = null, reason = "webgl-unavailable" } = {}) {
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return null;
    const hero = Boolean(brandImage);
    const motion = createCoinMotion(hero);
    const symbols = hero ? [2] : [0, 1, 2];
    let width = 0, height = 0, ratioX = 1, ratioY = 1;
    let busy = false;
    let elapsed = 0;
    let disposed = false;
    canvas.dataset.renderer = "canvas-2d";
    canvas.dataset.fallbackReason = reason;
    motion.setStep(Number(canvas.dataset.step) || 0);

    function drawCoin(symbol, pose) {
        const { x, y, z, scale, pitch, yaw, roll } = pose;
        const material = finishes[hero ? 1 : symbol];
        const outline = outlines[hero ? 2 : symbol];
        const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch), cz = Math.cos(roll), sz = Math.sin(roll);
        const f = 7 / (hero ? Math.max(1.42, 1.49 / (width / height)) : Math.max(1.33, 2.13 / (width / height)));
        const normal = [cz*sy*cx+sz*sx,sz*sy*cx-cz*sx,cy*cx];
        const face = normal[2] >= 0 ? 1 : -1;
        const thickness = hero ? .105 : [.142,.194,.083][symbol];
        function frame(depth) {
            const px=x+normal[0]*scale*depth, py=y+normal[1]*scale*depth, pz=z+normal[2]*scale*depth;
            const s=height*f/(2*(7-pz));
            return [s*scale*cz*cy,-s*scale*sz*cy,s*scale*(cz*sy*sx-sz*cx),-s*scale*(sz*sy*sx+cz*cx),width/2+px*s,height/2-py*s];
        }
        function plane(depth) {
            const m=frame(depth);
            ctx.setTransform(m[0]*ratioX,m[1]*ratioY,m[2]*ratioX,m[3]*ratioY,m[4]*ratioX,m[5]*ratioY);
        }
        // Join the front and rear outlines with one continuous metallic wall.
        const front=frame(face*thickness),back=frame(-face*thickness);
        const project=(m,[px,py])=>[m[0]*px+m[2]*py+m[4],m[1]*px+m[3]*py+m[5]];
        const frontPoints=outline.map(p=>project(front,p)),backPoints=outline.map(p=>project(back,p));
        ctx.setTransform(ratioX,0,0,ratioY,0,0);
        const rim=ctx.createLinearGradient(front[4]-140,front[5]-150,front[4]+140,front[5]+150);
        rim.addColorStop(0,material.dark);rim.addColorStop(.2,material.edge);rim.addColorStop(.31,"#ffffff");rim.addColorStop(.48,material.dark);rim.addColorStop(.65,material.accent);rim.addColorStop(.83,material.edge);rim.addColorStop(1,"#27202f");
        ctx.fillStyle=rim;path(ctx,backPoints);ctx.fill();
        for(let i=0;i<outline.length;i++){
            const j=(i+1)%outline.length;
            path(ctx,[backPoints[i],backPoints[j],frontPoints[j],frontPoints[i]]);ctx.fill();
            ctx.strokeStyle=rim;ctx.lineWidth=.6;ctx.stroke();
        }
        plane(face*thickness);
        ctx.save();
        const bevel=ctx.createLinearGradient(-1,1,1,-1);
        bevel.addColorStop(0,material.edge);bevel.addColorStop(.25,material.dark);bevel.addColorStop(.5,"#f5f0ff");bevel.addColorStop(.75,material.accent);bevel.addColorStop(1,"#483c55");
        ctx.fillStyle=bevel;path(ctx,outline,.985);ctx.fill();
        const enamel=ctx.createLinearGradient(0,1,.3,-1);
        enamel.addColorStop(0,hero?"#251b3b":"#17131f");enamel.addColorStop(.45,"#100d18");enamel.addColorStop(1,"#08060e");
        ctx.fillStyle=enamel;path(ctx,outline,.908);ctx.fill();
        ctx.strokeStyle=material.edge+"88";ctx.lineWidth=.009;path(ctx,outline,.879);ctx.stroke();
        ctx.strokeStyle=material.accent+"44";ctx.lineWidth=.007;path(ctx,outline,.853);ctx.stroke();
        ctx.save();path(ctx,outline,.86);ctx.clip();
        const shine=ctx.createLinearGradient(-1,1,1,-1);
        const highlight=.42+Math.sin(elapsed*.45)*.18;
        shine.addColorStop(0,"#ffffff00");shine.addColorStop(Math.max(0,highlight-.13),"#ffffff00");shine.addColorStop(highlight,"#ffffff12");shine.addColorStop(Math.min(1,highlight+.13),"#ffffff00");shine.addColorStop(1,"#ffffff00");
        ctx.fillStyle=shine;ctx.fillRect(-1.5,-1.5,3,3);ctx.restore();
        ctx.scale(face,1);
        if (hero) brand(ctx,brandImage);else glyph(ctx,symbol,material);
        ctx.restore();
    }

    const clock = watchScene(canvas,(delta, _clock, still) => {
        if (disposed || !width || !height) return;
        elapsed += delta*(hero?1:busy?1:.3);
        ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
        const poses=symbols.map(symbol=>({symbol,pose:motion.pose(symbol,elapsed,delta,still)}));
        poses.sort((a,b)=>a.pose.z-b.pose.z);
        for(const item of poses)drawCoin(item.symbol,item.pose);
        canvas.dataset.ready="true";
    },{fps:30,resize(w,h,rx,ry){width=w;height=h;ratioX=rx;ratioY=ry;}});
    return {
        setStep(index) { if(motion.setStep(index)){canvas.dataset.step=String(index);clock.redraw();} },
        setBusy(value) { busy=Boolean(value); },
        destroy() { disposed=true;clock.destroy();delete canvas.dataset.ready; }
    };
}
