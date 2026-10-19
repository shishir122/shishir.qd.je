-- RUN THIS ONCE AFTER setup.sql. KEEP THIS FILE PRIVATE. Never upload it to GitHub.
-- This is the secret that locks your preset files. Without it, the encrypted files are useless.
insert into lic_secrets(product, secret) values ('text-pack', 'c494126645e52926c6f4f4372281acb77be24f6cc80231e9c044db8c077e36f7')
on conflict (product) do update set secret = excluded.secret;
