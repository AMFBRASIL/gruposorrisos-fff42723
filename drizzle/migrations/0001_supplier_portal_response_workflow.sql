ALTER TABLE public.supplier_portal_responses ADD COLUMN notes text NOT NULL DEFAULT '', ADD COLUMN file_name text;
CREATE FUNCTION public.submit_supplier_prices(p_request_id uuid, p_items jsonb, p_notes text DEFAULT '', p_file text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.supplier_portal_requests; response_id uuid;
BEGIN
 SELECT * INTO r FROM public.supplier_portal_requests WHERE id=p_request_id FOR UPDATE;
 IF auth.uid() IS NULL OR r.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.supplier_memberships WHERE user_id=auth.uid() AND supplier_id=r.supplier_id) THEN RAISE EXCEPTION 'Sem acesso a este pedido'; END IF;
 IF r.status NOT IN ('aguardando','correcao') THEN RAISE EXCEPTION 'Pedido não está aberto para resposta'; END IF;
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) <> jsonb_array_length(r.payload->'items') OR length(p_notes)>2000 OR length(p_file)>255 THEN RAISE EXCEPTION 'Resposta inválida'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.payload->'items') expected WHERE expected->>'materialId'=i->>'materialId' AND (expected->>'requested')::numeric=(i->>'requested')::numeric) OR jsonb_typeof(i->'unitPrice') IS DISTINCT FROM 'number' OR (i->>'unitPrice')::numeric < 0 OR (i->>'unitPrice')::numeric > 1000000000) OR (SELECT count(DISTINCT i->>'materialId') FROM jsonb_array_elements(p_items) i) <> jsonb_array_length(p_items) THEN RAISE EXCEPTION 'Confira materiais, quantidades e preços'; END IF;
 INSERT INTO public.supplier_portal_responses(request_id,user_id,items,notes,file_name) VALUES(r.id,auth.uid(),p_items,p_notes,p_file) RETURNING id INTO response_id;
 UPDATE public.supplier_portal_requests SET status='resposta' WHERE id=r.id;
 RETURN response_id;
END $$;
REVOKE ALL ON FUNCTION public.submit_supplier_prices(uuid,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_supplier_prices(uuid,jsonb,text,text) TO authenticated;
CREATE FUNCTION public.review_supplier_response(p_request_id uuid, p_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_procurement_user() OR p_status NOT IN ('correcao','aprovado') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 UPDATE public.supplier_portal_requests SET status=p_status WHERE id=p_request_id AND status='resposta';
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não está em conferência'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.review_supplier_response(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_supplier_response(uuid,text) TO authenticated;