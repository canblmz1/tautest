"""Omit only mutant diagnostic strings; verify all other JSON events unchanged.

Dependency used in this reproduction: ijson==3.6.0.
Usage: python compact.py mutation.json compact.mutation.json compaction.json
"""
import sys, json, hashlib, collections, time, os
from pathlib import Path
import ijson

if len(sys.argv)!=4:
    raise SystemExit('Expected input report, NEW output report, NEW evidence path')
source,target,evidence=map(Path,sys.argv[1:])
partial=target.with_suffix(target.suffix+'.partial')
if source.resolve()==target.resolve() or target.exists() or partial.exists() or evidence.exists():
    raise SystemExit('Refusing to overwrite input or an existing output/evidence file')
removed=0; removed_chars=0; skip=False; stack=[]
def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as file:
        for chunk in iter(lambda:file.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()
original_hash=digest(source)
with source.open('rb') as file, partial.open('x',encoding='utf-8',newline='') as output:
    def before_value():
        if stack and stack[-1]['kind']=='array':
            if not stack[-1]['first']: output.write(',')
            stack[-1]['first']=False
    for prefix,event,value in ijson.parse(file):
        if skip:
            if event!='string':raise ValueError('Only string-valued mutant statusReason is eligible for omission')
            removed+=1; removed_chars+=len(value); skip=False; continue
        if event=='map_key':
            if prefix.startswith('files.') and prefix.endswith('.mutants.item') and value=='statusReason':skip=True;continue
            if not stack[-1]['first']:output.write(',')
            stack[-1]['first']=False
            output.write(json.dumps(value,ensure_ascii=False)+':')
        elif event in ('start_map','start_array'):
            before_value(); output.write('{' if event=='start_map' else '[')
            stack.append({'kind':'map' if event=='start_map' else 'array','first':True})
        elif event in ('end_map','end_array'):
            output.write('}' if event=='end_map' else ']');stack.pop()
        else:
            before_value()
            output.write(str(value) if event=='number' else json.dumps(value,ensure_ascii=False,allow_nan=False))
if skip or stack:raise ValueError('Incomplete JSON stream')
original=collections.Counter(); compact=collections.Counter(); identity=hashlib.sha256(); identity2=hashlib.sha256()
def verify(path,counts,hasher):
    with path.open('rb') as file:
        for prefix,event,value in ijson.parse(file):
            if (prefix.startswith('files.') and prefix.endswith('.mutants.item.statusReason')) or (prefix.startswith('files.') and prefix.endswith('.mutants.item') and event=='map_key' and value=='statusReason'):continue
            if event=='number':value=str(value)
            hasher.update(json.dumps([prefix,event,value],ensure_ascii=False,separators=(',',':')).encode('utf-8'));hasher.update(b'\n')
            if prefix.endswith('.mutants.item.status') and event=='string':counts[value]+=1
verify(source,original,identity);verify(partial,compact,identity2)
if original!=compact or identity.digest()!=identity2.digest():raise ValueError('Non-diagnostic content changed')
if original_hash!=digest(source):raise ValueError('Original input changed')
if target.exists() or evidence.exists():raise ValueError('Output appeared during processing; refusing overwrite')
os.replace(partial,target)
proof={'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'originalBytes':source.stat().st_size,'originalSha256':original_hash,'compactBytes':target.stat().st_size,'compactSha256':digest(target),'removedField':'files.*.mutants[].statusReason only','removedRecords':removed,'removedStringCharacters':removed_chars,'counts':dict(original),'allOtherJsonEventsIdentical':True,'otherContentEventSha256':identity.hexdigest(),'originalUnchanged':True,'externalAdoption':False}
with evidence.open('x',encoding='utf-8') as output:output.write(json.dumps(proof,indent=2)+'\n')
print(json.dumps(proof))
