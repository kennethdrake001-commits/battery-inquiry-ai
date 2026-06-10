update public.product_assets
set file_url = null
where file_url is not null and file_url != '';
