import { watchScene } from "./scene-loop.mjs";

// Ordered cells vary in both area and shade; geometry is painted at screen size.
export function mountDither(canvas, { variant = "landing" } = {}) {
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const bayer = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
    const dashboard = variant === "dashboard";
    let width = 0, height = 0, ratioX = 1, ratioY = 1;
    let clockTime = 0;

    function draw() {
        if (!width || !height) return;
        const mobile = width < 760;
        const light = document.documentElement.dataset.theme === "light";
        const colors = light
            ? ["#401a7d", "#8f5bdb", "#be91f6", "#ffffff", "#211530"]
            : ["#7946b9", "#ab71ec", "#d8b8ff", "#ffffff", "#37214f"];
        const pitch = mobile ? 13 : dashboard ? 19 : 17;
        const columns = Math.ceil(width / pitch), rows = Math.ceil(height / pitch);
        ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.setTransform(ratioX,0,0,ratioY,0,0);
        for (let row=0;row<rows;row++) {
            const v=row*pitch/height;
            for (let col=0;col<columns;col++) {
                const u=col*pitch/width;
                const radius=Math.hypot((u-(mobile ? .5 : .77))*1.8,(v-(mobile ? .29 : .48))*1.55);
                const envelope=dashboard ? .6+.25*Math.sin(u*5+v*4) : Math.max(0,1-radius)**.7;
                const edge=Math.max(0,Math.min(1,u*18,(1-u)*18,v*14,(1-v)*14));
                const quiet=dashboard?1:mobile?Math.max(0,1-v*1.5):Math.min(1,Math.max(0,(u-.29)*3));
                const wave=Math.sin(u*11-v*8+Math.sin(v*6+clockTime*.22)*1.6+clockTime*.3);
                const ripple=Math.sin(radius*17-clockTime*.42);
                const level=envelope*quiet*(.5+.22*wave+.15*ripple);
                const threshold=(bayer[(row%4)*4+col%4]+.5)/16;
                if(level<threshold*.95||edge<=0)continue;
                const seed=((col*37+row*71)%101)/100;
                const size=Math.max(2,Math.round((3+10*level+3*seed)/2)*2);
                const shade=ripple>.63?3:wave<-.45?4:Math.min(2,Math.floor((wave+1)*1.5));
                ctx.fillStyle=colors[shade];
                ctx.globalAlpha=(dashboard ? (light ? .32 : .27) : (light ? .66 : .72))*edge*(.5+.5*level);
                ctx.fillRect(Math.round(col*pitch+(pitch-size)/2),Math.round(row*pitch+(pitch-size)/2),size,size);
            }
        }
        ctx.globalAlpha=1;
    }
    const clock=watchScene(canvas,(_delta,elapsed)=>{clockTime=elapsed;draw();},{
        fps:12,maxWidth:1600,maxHeight:1100,
        resize(w,h,rx,ry){width=w;height=h;ratioX=rx;ratioY=ry;}
    });
    const theme=new MutationObserver(()=>clock.redraw());
    theme.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
    return ()=>{clock.destroy();theme.disconnect();};
}
