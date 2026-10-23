"""Scan a source-only skill and optionally build a reproducible, metadata-free ZIP."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import stat
import sys
import zipfile

TEXT_SUFFIXES = {'.md', '.json', '.yaml', '.yml', '.py', '.ps1', '.txt'}
BLOCKED_PARTS = {'.git', '__pycache__', 'node_modules', 'logs', 'cache', 'private', 'secrets', 'runtime', 'backups', 'sessions'}
BLOCKED_FILES = {'config.json', 'cookies.json', 'tokens.json', 'session.json', 'credentials.json', 'deployment.request.json', 'deployment-state.json'}
PATTERNS = {
    'private-key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    'credential-prefix': re.compile(r'\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|hf_[A-Za-z0-9]{20,})\b'),
    'bearer-value': re.compile(r'(?i)Bearer\s+[A-Za-z0-9._~-]{20,}'),
    'credential-url': re.compile(r'(?i)[?&](?:token|access_token|api_key|auth|ticket)=[A-Za-z0-9._~%-]{8,}'),
    'personal-home': re.compile(r'(?i)\b[A-Z]:[\\/]+Users[\\/]+[^<>\s/\\"\']+'),
    'account-like-number': re.compile(r'(?<![A-Za-z0-9])\d{7,12}(?![A-Za-z0-9])'),
    'email-address': re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b'),
    'credential-assignment': re.compile(r'''(?im)["']?\b(?:api[_-]?key|access[_-]?token|consoleToken|webuiToken|password|secret|token)["']?\s*[:=]\s*["']?[A-Za-z0-9_./+-]{12,}'''),
}

def link_or_junction(path):
    attrs = getattr(path.lstat(), 'st_file_attributes', 0)
    return path.is_symlink() or bool(attrs & getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 0x400))

def scan(root, deny):
    findings, files = [], []
    def matches(value):
        result=[name for name,pattern in PATTERNS.items() if pattern.search(value)]
        if any(part.casefold() in value.casefold() for part in deny):
            result.append('private-denylist-match')
        return result
    def visit(directory):
        for path in sorted(directory.iterdir()):
            relative = path.relative_to(root).as_posix()
            path_matches=matches(relative)
            if path_matches:
                findings.extend({'file':'[redacted path]','rule':rule} for rule in path_matches)
                continue
            if link_or_junction(path):
                findings.append({'file':relative,'rule':'link-or-junction'})
                continue
            if path.name.lower() in BLOCKED_PARTS:
                findings.append({'file':relative,'rule':'runtime-or-private-directory'})
                continue
            if path.is_dir():
                visit(path)
                continue
            if path.name.startswith('.env') or path.name.lower() in BLOCKED_FILES or path.suffix.lower() not in TEXT_SUFFIXES:
                findings.append({'file':relative,'rule':'non-source-or-private-file'})
                continue
            if path.stat().st_size > 1024*1024:
                findings.append({'file':relative,'rule':'unexpected-large-file'})
                continue
            try:
                text = path.read_bytes().decode('utf-8-sig')
            except UnicodeError:
                findings.append({'file':relative,'rule':'non-utf8-file'})
                continue
            if '\0' in text:
                findings.append({'file':relative,'rule':'binary-data'})
                continue
            for rule in matches(text):
                findings.append({'file':relative,'rule':rule})
            if path.name == 'deployment.example.json':
                try:
                    config = json.loads(text)
                    if config.get('bot_qq') or config.get('owner_qq') or config.get('allowed_private_qq') or config.get('allowed_group_qq'):
                        findings.append({'file':relative,'rule':'populated-account-template'})
                    if config.get('llm',{}).get('base_url') or config.get('voice',{}).get('reference_audio') or config.get('voice',{}).get('reference_transcript'):
                        findings.append({'file':relative,'rule':'populated-personal-template'})
                except (ValueError,AttributeError):
                    findings.append({'file':relative,'rule':'invalid-template-json'})
            files.append((path,relative))
    visit(root)
    return findings, files

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',required=True)
    parser.add_argument('--deny-file',help='Local private strings, one per line; must be outside the package')
    parser.add_argument('--zip',dest='zip_path')
    args=parser.parse_args()
    original=Path(args.root).absolute()
    if link_or_junction(original):
        raise ValueError('Scan the real skill source, not a junction or symlink')
    root=original.resolve(strict=True)
    if not root.is_dir() or not (root/'SKILL.md').is_file():
        raise ValueError('Expected a skill source folder with SKILL.md')
    deny=[]
    if args.deny_file:
        denied=Path(args.deny_file).resolve(strict=True)
        if denied.is_relative_to(root):
            raise ValueError('Keep the private denylist outside the shared folder')
        deny=[s.strip() for s in denied.read_text(encoding='utf-8-sig').splitlines() if s.strip()]
    findings,files=scan(root,deny)
    if findings:
        print(json.dumps({'ok':False,'findings':findings},ensure_ascii=False,indent=2))
        return 1
    report={'ok':True,'files':len(files),'contentBytes':sum(p.stat().st_size for p,_ in files),'denylistChecked':bool(deny)}
    if args.zip_path:
        output=Path(args.zip_path).absolute()
        if output.resolve().is_relative_to(root):
            raise ValueError('Write the ZIP outside the source skill folder')
        output.parent.mkdir(parents=True,exist_ok=True)
        with zipfile.ZipFile(output,'x',compression=zipfile.ZIP_DEFLATED) as archive:
            for path,relative in files:
                info=zipfile.ZipInfo(root.name+'/'+relative,date_time=(2020,1,1,0,0,0))
                info.compress_type=zipfile.ZIP_DEFLATED
                info.create_system=3
                info.external_attr=0o100644<<16
                archive.writestr(info,path.read_bytes())
        report['zipSha256']=hashlib.sha256(output.read_bytes()).hexdigest()
        report['zipBytes']=output.stat().st_size
    print(json.dumps(report,ensure_ascii=False,indent=2))
    return 0

if __name__=='__main__':
    try:
        sys.exit(main())
    except (OSError,ValueError) as error:
        print(json.dumps({'ok':False,'errorType':type(error).__name__,'message':'Check input paths and package structure; no archive was successfully completed.'}))
        sys.exit(2)
