#!/usr/bin/env python3
"""WebP export, transparent-edge checks, contact sheets and manifest.

Requirements: Python 3.10+, Pillow with WebP support (tested with 12.3.0).
Run after Blender: python source/export_assets.py --root .
Run early as renders arrive: python source/export_assets.py --root . --allow-partial
Image resizing uses premultiplied alpha to avoid a dark fringe.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops, features

NAMES = ['empty-trips','create-trip','empty-saved','invite-companions',
         'compare-plans','confirm-plan','empty-explore','empty-search']
MEANINGS = {
    'empty-trips':'Successful empty trip query; rounded suitcase',
    'create-trip':'Start the first candidate plan; folded map and destination pin',
    'empty-saved':'Successful empty saved-plan query; cards and bookmark',
    'invite-companions':'Invite travel companions; two abstract people and plus',
    'compare-plans':'Two equal unselected candidates; no winning or confirmed state',
    'confirm-plan':'Server-confirmed itinerary; calendar and check, not a booking confirmation',
    'empty-explore':'Successful empty exploration with no applied filters; compass',
    'empty-search':'Successful empty result with applied filters; route card and magnifier',
}

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def shrink(image,size):
    return image.convert('RGBa').resize((size,size),Image.Resampling.LANCZOS).convert('RGBA')

def inspect(image):
    assert image.mode=='RGBA', f'Expected RGBA, got {image.mode}'
    width,height=image.size; alpha=image.getchannel('A'); hist=alpha.histogram()
    bounds=alpha.getbbox()
    assert bounds is not None, 'Empty asset'
    border=Image.new('L',image.size)
    d=ImageDraw.Draw(border); d.rectangle((0,0,width-1,height-1),outline=255,width=2)
    assert ImageChops.multiply(alpha,border).getbbox() is None, 'Clipped/nontransparent outer edge'
    assert hist[0]>width*height*.30, 'Expected isolated transparent illustration'
    assert hist[255]>width*height*.035, 'Expected solid editable geometry render'
    occupancy=max((bounds[2]-bounds[0])/width,(bounds[3]-bounds[1])/height)
    assert .70<=occupancy<=.84, f'Unexpected silhouette occupancy: {occupancy:.3f}'
    center=((bounds[0]+bounds[2])/2/width,(bounds[1]+bounds[3])/2/height)
    assert abs(center[0]-.5)<.025 and abs(center[1]-.5)<.025, f'Off-center: {center}'
    return {'mode':image.mode,'width':width,'height':height,'alphaBounds':list(bounds),
            'longestDimensionOccupancy':round(occupancy,4),
            'alphaCenter':[round(x,4) for x in center],
            'fullyTransparentFraction':round(hist[0]/(width*height),4),
            'fullyOpaqueFraction':round(hist[255]/(width*height),4),
            'outerTwoPixelBorderTransparent':True}

def sheet(root,images,size,dark):
    bg='#101116' if dark else '#FFFFFF'; fg='#DFE5EF' if dark else '#33465F'
    sub='#8D9AB1' if dark else '#687A93'
    pad=32; header=74; cell_width=max(size+64,220); cell_height=size+70
    canvas=Image.new('RGBA',(cell_width*4+pad*2,header+cell_height*2+pad),bg)
    draw=ImageDraw.Draw(canvas)
    title=ImageFont.load_default(size=23); body=ImageFont.load_default(size=15)
    draw.text((pad,20),f'Galanda / Travel 3D / {"Dark" if dark else "Light"}',fill=fg,font=title)
    draw.text((pad,49),f'{size}px actual slots · same transparent artwork · Blender geometry',fill=sub,font=body)
    for i,name in enumerate(NAMES):
        if name not in images: continue
        left=pad+(i%4)*cell_width+(cell_width-size)//2
        top=header+(i//4)*cell_height
        canvas.alpha_composite(shrink(images[name],size),(left,top))
        tw=draw.textbbox((0,0),name,font=body)[2]
        draw.text((pad+(i%4)*cell_width+(cell_width-tw)//2,top+size+15),name,fill=fg,font=body)
    path=root/'previews'/f'contact-sheet-{size}-{"dark" if dark else "light"}.png'
    canvas.convert('RGB').save(path,optimize=True)
    return path

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    ap.add_argument('--allow-partial',action='store_true')
    args=ap.parse_args(); root=args.root.resolve()
    assert features.check('webp'), 'Pillow needs libwebp support'
    for name in ('web','previews'): (root/name).mkdir(parents=True,exist_ok=True)
    stats_file=root/'source'/'model-stats.json'
    model_stats=json.loads(stats_file.read_text()) if stats_file.exists() else {}
    images={}; entries=[]; total384=0
    for name in NAMES:
        src=root/'renders'/f'{name}.png'
        if not src.exists():
            if args.allow_partial:continue
            raise FileNotFoundError(src)
        image=Image.open(src).convert('RGBA'); images[name]=image
        qa=inspect(image)
        if not args.allow_partial:assert image.size==(768,768), f'{name} source must be 768px'
        blend=root/'models'/f'{name}.blend'
        entry={'name':name,'meaning':MEANINGS[name],
               'source':{'path':str(src.relative_to(root)),'bytes':src.stat().st_size,'sha256':digest(src),**qa},
               'model':{'path':str(blend.relative_to(root)),'bytes':blend.stat().st_size,
                        'sha256':digest(blend),**model_stats.get(name,{})},'variants':[]}
        for size in (256,384,512):
            out=root/'web'/f'{name}-{size}.webp'
            shrink(image,size).save(out,'WEBP',quality=88,method=6,lossless=False,exact=True)
            decoded=Image.open(out)
            assert decoded.n_frames==1 and decoded.mode=='RGBA', 'Static alpha WebP required'
            assert out.read_bytes()[12:16]==b'VP8X', 'Expected extended WebP alpha container'
            assert out.stat().st_size<80000, 'Unexpected asset payload'
            validation=inspect(decoded)
            entry['variants'].append({'path':str(out.relative_to(root)),'bytes':out.stat().st_size,
                                      'sha256':digest(out),**validation})
            if size==384:total384+=out.stat().st_size
        entries.append(entry)
        print(f'{name}: PNG {src.stat().st_size:,} bytes; WebP384 {entry["variants"][1]["bytes"]:,} bytes')
    assert total384<400000,'384px set exceeds total runtime budget'
    contacts=[]
    for size in (128,256):
        for dark in (False,True):contacts.append(str(sheet(root,images,size,dark).relative_to(root)))
    manifest={'version':1,'assetSet':'galanda-travel-spots-3d','sourceApplication':'Blender 4.3.2',
              'renderer':'Cycles CPU','samples':512,'denoising':False,
              'viewTransform':'AgX / Medium High Contrast','externalDependencies':[],
              'themeVariants':'One neutral palette; validated on #FFFFFF and #101116',
              'runtimeContract':{'displaySize':128,'recommendedSourceSize':384,
                                  'sizes':[256,384,512],'format':'static alpha WebP',
                                  'background':'transparent','cssFilter':'none','cssShadow':'none',
                                  'imageFit':'contain','decorative':True,'alt':'','ariaHidden':True},
              'runtime384TotalBytes':total384,'contactSheets':contacts,'assets':entries}
    (root/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
    print(f'PASS: {len(entries)} assets; 384px set {total384:,} bytes; transparent edges and centered silhouettes')

if __name__=='__main__':main()
