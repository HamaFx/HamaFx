# V1 Backup and Restore

## Backup Artifacts

- `backups/hamafx-v1-b386ec6-20260207-1707.tar.gz`
- `backups/hamafx-v1-b386ec6-20260207-1707.tar.gz.sha256`
- `backups/hamafx-pre-v2-working-tree-20260207-1707.tar.gz`
- `backups/hamafx-pre-v2-working-tree-20260207-1707.tar.gz.sha256`

## Verify Integrity

```bash
sha256sum -c backups/hamafx-v1-b386ec6-20260207-1707.tar.gz.sha256
sha256sum -c backups/hamafx-pre-v2-working-tree-20260207-1707.tar.gz.sha256
```

## Restore V1 Snapshot

```bash
mkdir -p /tmp/hamafx-v1-restore
cd /tmp/hamafx-v1-restore
tar -xzf /home/hama/Hama\ Projects/forex-crypto-trading-platform/backups/hamafx-v1-b386ec6-20260207-1707.tar.gz
```

## Restore Pre-V2 Working Tree Snapshot

```bash
mkdir -p /tmp/hamafx-pre-v2-restore
cd /tmp/hamafx-pre-v2-restore
tar -xzf /home/hama/Hama\ Projects/forex-crypto-trading-platform/backups/hamafx-pre-v2-working-tree-20260207-1707.tar.gz
```

## Notes

- V1 snapshot is archived directly from commit `b386ec6`.
- Pre-V2 working snapshot excludes `.git`, `node_modules`, build artifacts, and test artifacts.
