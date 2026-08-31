import math, collections, os
from PIL import Image, ImageDraw, ImageFilter, ImageChops

def hull(pts):
    pts=sorted(set(pts))
    def half(ps):
        out=[]
        for p in ps:
            while len(out)>=2 and (out[-1][0]-out[-2][0])*(p[1]-out[-2][1])-(out[-1][1]-out[-2][1])*(p[0]-out[-2][0])<=0: out.pop()
            out.append(p)
        return out
    return half(pts)[:-1]+half(pts[::-1])[:-1]

def solve8(src,dst):
    A,B=[],[]
    for (sx,sy),(dx,dy) in zip(src,dst):
        A.append([dx,dy,1,0,0,0,-sx*dx,-sx*dy]); B.append(sx)
        A.append([0,0,0,dx,dy,1,-sy*dx,-sy*dy]); B.append(sy)
    n=8
    for c in range(n):
        p=max(range(c,n),key=lambda r:abs(A[r][c])); A[c],A[p]=A[p],A[c]; B[c],B[p]=B[p],B[c]
        for r in range(n):
            if r==c: continue
            f=A[r][c]/A[c][c]
            for k in range(c,n): A[r][k]-=f*A[c][k]
            B[r]-=f*B[c]
    return [B[i]/A[i][i] for i in range(n)]

def screen_quad(path, thr=200):
    im=Image.open(path).convert('RGB'); w,h=im.size; px=im.load()
    bright=bytearray(w*h)
    for y in range(h):
        for x in range(w):
            r,g,b=px[x,y]
            if 0.2126*r+0.7152*g+0.0722*b>thr: bright[y*w+x]=1
    seen=bytearray(w*h); best=[]; bn=0
    for sy in range(0,h,3):
        for sx in range(0,w,3):
            i=sy*w+sx
            if not bright[i] or seen[i]: continue
            q=collections.deque([(sx,sy)]); seen[i]=1; comp=[]
            while q:
                x,y=q.popleft(); comp.append((x,y))
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx,ny=x+dx,y+dy
                    if 0<=nx<w and 0<=ny<h:
                        j=ny*w+nx
                        if bright[j] and not seen[j]: seen[j]=1; q.append((nx,ny))
            if len(comp)>bn: bn,best=len(comp),comp
    poly=hull(best)
    br=None
    for i in range(len(poly)):
        a,b=poly[i],poly[(i+1)%len(poly)]
        th=math.atan2(b[1]-a[1],b[0]-a[0]); c,s=math.cos(-th),math.sin(-th)
        us=[p[0]*c-p[1]*s for p in poly]; vs=[p[0]*s+p[1]*c for p in poly]
        u0,u1,v0,v1=min(us),max(us),min(vs),max(vs)
        if br is None or (u1-u0)*(v1-v0)<br[0]: br=((u1-u0)*(v1-v0),th,u0,u1,v0,v1)
    _,th,u0,u1,v0,v1=br
    c,s=math.cos(th),math.sin(th)
    back=lambda u,v:(u*c-v*s,u*s+v*c)
    seed=[back(u0,v0),back(u1,v0),back(u1,v1),back(u0,v1)]

    drop=0.10*min(math.dist(seed[0],seed[1]),math.dist(seed[1],seed[2]))
    groups=[[] for _ in range(4)]
    for p in poly:
        if min(math.dist(p,q) for q in seed)<drop: continue
        d=[]
        for k in range(4):
            a,b=seed[k],seed[(k+1)%4]; L=math.dist(a,b)
            t=max(0,min(1,((p[0]-a[0])*(b[0]-a[0])+(p[1]-a[1])*(b[1]-a[1]))/L**2))
            d.append(math.dist(p,(a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]))))
        groups[d.index(min(d))].append(p)
    lines=[]
    for g in groups:
        n=len(g); mx=sum(p[0] for p in g)/n; my=sum(p[1] for p in g)/n
        sxx=syy=sxy=0
        for x,y in g:
            sxx+=(x-mx)**2; syy+=(y-my)**2; sxy+=(x-mx)*(y-my)
        thl=0.5*math.atan2(2*sxy,sxx-syy)
        lines.append(((mx,my),(math.cos(thl),math.sin(thl))))
    def inter(l1,l2):
        (x1,y1),(a1,b1)=l1; (x2,y2),(a2,b2)=l2
        t=((x2-x1)*b2-(y2-y1)*a2)/(a1*b2-b1*a2)
        return (x1+a1*t, y1+b1*t)
    quad=[inter(lines[k-1],lines[k]) for k in range(4)]
    quad=quad[1:]+quad[:1]

    # orient: portrait, and never upside down
    d=lambda i,j: math.dist(quad[i],quad[j])
    short01 = d(0,1) < d(1,2)
    edges=[(0,1),(2,3)] if short01 else [(1,2),(3,0)]
    mid=lambda p:((quad[p[0]][0]+quad[p[1]][0])/2,(quad[p[0]][1]+quad[p[1]][1])/2)
    top=min(edges,key=lambda p: mid(p)[1]); bot=edges[0] if top is edges[1] else edges[1]
    tl,tr=sorted(top,key=lambda k: quad[k][0])
    bl=min(bot,key=lambda k: math.dist(quad[k],quad[tl])); brc=bot[0] if bl==bot[1] else bot[1]
    return [quad[tl],quad[tr],quad[brc],quad[bl]], im

def inset(q, d):
    """Pull the quad in by d px along every edge. The fit lands within ~2px of the
    glass, and on the low side the UI then bleeds onto the bezel."""
    c=(sum(p[0] for p in q)/4, sum(p[1] for p in q)/4); lines=[]
    for k in range(4):
        a,b=q[k],q[(k+1)%4]
        ex,ey=b[0]-a[0],b[1]-a[1]; L=math.hypot(ex,ey); ex,ey=ex/L,ey/L
        nx,ny=-ey,ex
        if (c[0]-a[0])*nx+(c[1]-a[1])*ny<0: nx,ny=-nx,-ny
        lines.append(((a[0]+nx*d,a[1]+ny*d),(ex,ey)))
    def it(l1,l2):
        (x1,y1),(a1,b1)=l1; (x2,y2),(a2,b2)=l2
        t=((x2-x1)*b2-(y2-y1)*a2)/(a1*b2-b1*a2); return (x1+a1*t,y1+b1*t)
    return [it(lines[k-1],lines[k]) for k in range(4)]

def occluders(base, quad, thr=235, lo=150):
    """What sits in FRONT of the glass: the fingers curling over the edge and the
    bezel shadow they cast across it. Brightness alone cannot say — these mockups
    ship a placeholder app, so half the screen is legitimately dark. Connectivity
    can: the hand is one enormous mass that reaches far outside the quad, while
    every dark element of the placeholder lies wholly within it. Returns an alpha
    where 255 keeps the UI; the held-back band ramps by luminance so a fingertip
    is solid and the shadow's soft edge stays soft."""
    w,h=base.size; g=base.convert('L'); gp=g.load()
    inq=Image.new('L',(w,h),0); ImageDraw.Draw(inq).polygon([tuple(p) for p in quad],fill=255); ip=inq.load()
    seen=bytearray(w*h); keep=None
    for sy in range(h):
        for sx in range(w):
            j=sy*w+sx
            if seen[j] or gp[sx,sy]>=thr: continue
            q=collections.deque([(sx,sy)]); seen[j]=1; comp=[]; ins=0
            while q:
                x,y=q.popleft(); comp.append((x,y))
                if ip[x,y]>=128: ins+=1
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx,ny=x+dx,y+dy
                    if 0<=nx<w and 0<=ny<h:
                        k=ny*w+nx
                        if not seen[k] and gp[nx,ny]<thr: seen[k]=1; q.append((nx,ny))
            if len(comp)-ins>10000 and (keep is None or ins>keep[0]): keep=(ins,comp)
    a=Image.new('L',(w,h),255)
    if not keep: return a, 0
    # Connectivity alone over-reaches: placeholder text that runs off the edge of
    # the screen touches the bezel and joins the hand's component, then ghosts
    # through the pasted UI. An opening separates them on stroke width — a letter
    # is a few px thick, the shadow band and a fingertip are tens.
    p=Image.new('L',(w,h),0); pp=p.load()
    for x,y in keep[1]:
        if ip[x,y]>=128: pp[x,y]=255
    p=p.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.MaxFilter(9))
    pp=p.load(); ap=a.load(); n=0
    for y in range(h):
        for x in range(w):
            if pp[x,y]<128: continue
            v=gp[x,y]; ap[x,y]=0 if v<=lo else round(255*(v-lo)/(thr-lo)); n+=1
    return a.filter(ImageFilter.GaussianBlur(1.0)), n

JOBS=[('6a34624f7400e78c68c2c515_m1.png','matas-app-new.jpg','matas-scene-01'),
      ('6a34624fb70ca3d0d7dfc18d_m3.png','matas-points-ui.jpg','matas-scene-02'),
      ('6a34624f61bb6f90181cd492_m5.png','matas-rewards-ui.jpg','matas-scene-03')]
CORNER=0.14
INSET=2.5

for mock,shot,out in JOBS:
    quad, base = screen_quad(f'tools/{mock}')
    quad = inset(quad, INSET)
    w,h=base.size
    W=(math.dist(quad[0],quad[1])+math.dist(quad[3],quad[2]))/2
    H=(math.dist(quad[0],quad[3])+math.dist(quad[1],quad[2]))/2
    r=CORNER*W
    local=Image.new('L',(round(W),round(H)),0)
    ImageDraw.Draw(local).rounded_rectangle([0,0,round(W)-1,round(H)-1],radius=round(r),fill=255)
    mco=solve8([(0,0),(W,0),(W,H),(0,H)],quad)
    mask=local.transform((w,h),Image.PERSPECTIVE,mco,Image.BILINEAR).filter(ImageFilter.GaussianBlur(0.7))

    # Let whatever sits in front of the glass stay in front of it.
    occl, held = occluders(base, quad)
    mask = ImageChops.multiply(mask, occl)

    base=base.convert('RGBA')
    src=Image.open(f'public/images/matas/{shot}').convert('RGBA')
    t=W/H; sw,sh=src.size
    if sw/sh>t:
        # Never crop an app screenshot horizontally — the side margins are the
        # layout. Keep the full width and grow the canvas downward instead; the
        # bottom rows of these captures are flat white, so the extension is invisible.
        nh=round(sw/t); pad=Image.new('RGBA',(sw,nh))
        pad.paste(src,(0,0)); pad.paste(src.crop((0,sh-1,sw,sh)).resize((sw,nh-sh)),(0,sh))
        src=pad
    else:       nh=int(sw/t); src=src.crop((0,0,sw,nh))
    co=solve8([(0,0),(src.width,0),(src.width,src.height),(0,src.height)],quad)
    warped=src.transform((w,h),Image.PERSPECTIVE,co,Image.BICUBIC)
    comp=base.copy(); comp.paste(warped,(0,0),mask)
    comp.convert('RGB').resize((1600,round(1600*h/w)),Image.LANCZOS)\
        .save(f'public/images/matas/{out}.webp','WEBP',quality=90,method=6)
    sides=[math.dist(quad[i],quad[(i+1)%4]) for i in range(4)]
    print(f"  {out}: {round(W)}x{round(H)}  sides {[round(x) for x in sides]}  "
          f"taper {abs(sides[0]-sides[2]):.0f}/{abs(sides[1]-sides[3]):.0f}px  "
          f"shot {'padded' if src.height>Image.open(f'public/images/matas/{shot}').height else 'cropped'} "
          f"to {src.width}x{src.height}  in front of glass {100*held/(W*H):.1f}% of screen")
