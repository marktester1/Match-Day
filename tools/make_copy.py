# Usage: python3 make_copy.py "<Title>" <out.html>
# Makes a blank copy of the match-day app that opens on the setup screen.
import sys,re
title,out=sys.argv[1],sys.argv[2]
s=open('index.html').read()
s=re.sub(r'<title>.*?</title>',f'<title>{title}</title>',s,count=1)
s=re.sub(r"/\*CFG\*/.*?/\*END\*/","/*CFG*/const DEFAULT_CFG={team:'',short:'',size:5};/*END*/",s,count=1,flags=re.S)
open(out,'w').write(s)
