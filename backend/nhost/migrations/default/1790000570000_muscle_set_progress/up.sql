-- Fractional set counts are computed on read: edits/deletes and catalog corrections
-- therefore immediately update historical charts without a refresh job.
INSERT INTO public.muscle_groups (value) VALUES
  ('front_delts'), ('side_delts'), ('rear_delts')
ON CONFLICT (value) DO NOTHING;

-- Explicitly reviewed shoulder associations from the public catalog. Unclear
-- movements retain the legacy shoulders label; user-owned exercises are untouched.
UPDATE public.exercises AS e SET primary_muscle_group = mapping.target
FROM (VALUES
  ('019e0675-a1eb-7e4c-ba00-d2197d87061c'::uuid, 'front_delts'),
  ('019e0675-a205-7679-8527-0a2470e7cb37'::uuid, 'front_delts'),
  ('019e0675-a231-7917-8398-72cc8043a282'::uuid, 'front_delts'),
  ('019e0675-a242-7a3c-8a57-b12e2cff215d'::uuid, 'rear_delts'),
  ('019e0675-a264-7792-a2be-a8b17a27b6ac'::uuid, 'rear_delts'),
  ('019e0675-a28c-7c1f-ae47-1bedaa726f5b'::uuid, 'front_delts'),
  ('019e0675-a296-71b8-9714-9fb2406eb711'::uuid, 'rear_delts'),
  ('019e0675-a2a1-77d0-9cee-39cfad6a62e9'::uuid, 'front_delts'),
  ('019e0675-a2e3-7f04-b10f-d64831ae8263'::uuid, 'rear_delts'),
  ('019e0675-a2e8-7066-b29a-cde5f2491cfb'::uuid, 'rear_delts'),
  ('019e0675-a329-7582-a1ff-805cff13032f'::uuid, 'front_delts'),
  ('019e0675-a36c-78c4-ae65-6e77ffa9f1fc'::uuid, 'rear_delts'),
  ('019e0675-a36e-7a33-b77a-bca160245c46'::uuid, 'rear_delts'),
  ('019e0675-a37d-7e6d-8765-cd171ca730bf'::uuid, 'side_delts'),
  ('019e0675-a37f-70d0-a97e-9b3ac916a0bb'::uuid, 'front_delts'),
  ('019e0675-a4a2-784b-aae5-1d52b49880a8'::uuid, 'front_delts'),
  ('019e0675-a4a8-7aa7-967e-bbef20679703'::uuid, 'rear_delts'),
  ('019e0675-a4ba-7462-b51f-8c435badef52'::uuid, 'rear_delts'),
  ('019e0675-a4be-7052-b3e8-0cc9aa3494dd'::uuid, 'front_delts'),
  ('019e0675-a4c4-7e33-857a-8bf1bd63c51d'::uuid, 'side_delts'),
  ('019e0675-a4c8-771b-893e-d3daeb63d291'::uuid, 'side_delts'),
  ('019e0675-a4ce-724f-8fd9-13e35b5862bc'::uuid, 'side_delts'),
  ('019e0675-a4d6-7353-bb70-d609f696949d'::uuid, 'front_delts'),
  ('019e0675-a51f-796a-a63d-22a1f661a14b'::uuid, 'rear_delts'),
  ('019e0675-a554-7d73-8685-b10d3629497b'::uuid, 'front_delts'),
  ('019e0675-a55f-72b0-ba22-8c727131a13e'::uuid, 'front_delts'),
  ('019e0675-a55f-7f1b-ac58-de453a7e4ea9'::uuid, 'front_delts'),
  ('019e0675-a568-7578-bf44-2e1fa2168c68'::uuid, 'front_delts'),
  ('019e0675-a56e-7367-94fb-804e229cc1be'::uuid, 'front_delts'),
  ('019e0675-a5a1-7106-9767-8c15560e7525'::uuid, 'front_delts'),
  ('019e0675-a648-7e92-a5bc-389232fd150b'::uuid, 'front_delts'),
  ('019e0675-a65a-7b8b-aacf-9a2252458452'::uuid, 'front_delts'),
  ('019e0675-a65a-7d26-9060-19703c377411'::uuid, 'front_delts'),
  ('019e0675-a6a8-7857-9163-d832e4de538d'::uuid, 'side_delts'),
  ('019e0675-a6d4-7cde-b233-cc979460d43a'::uuid, 'front_delts'),
  ('019e0675-a6ea-7405-8e36-260688cdd2a5'::uuid, 'rear_delts'),
  ('019e0675-a728-728a-95a4-fa9bd8521834'::uuid, 'side_delts'),
  ('019e0675-a730-754f-92e7-1cfd3be4b6bf'::uuid, 'rear_delts'),
  ('019e0675-a73d-7ecf-9e91-c845c8e79731'::uuid, 'front_delts'),
  ('019e0675-a78c-7fe2-a03e-d4724e853ce8'::uuid, 'side_delts'),
  ('019e0675-a79f-739b-9679-108e02e39487'::uuid, 'front_delts'),
  ('019e0675-a7c1-7204-8883-457ca3c478ac'::uuid, 'side_delts'),
  ('019e0675-a874-7bd6-aadf-b8dfaa326693'::uuid, 'side_delts'),
  ('019e0675-a90b-7eda-af62-6e1291adeff4'::uuid, 'rear_delts'),
  ('019e0675-a90e-70c8-93a4-11ee76da45e0'::uuid, 'rear_delts'),
  ('019e0675-a91e-7c46-b44c-7b6477224801'::uuid, 'rear_delts'),
  ('019e0675-a967-7295-9e3c-5491b1afd9cc'::uuid, 'front_delts'),
  ('019e0675-a96c-70a4-bb1b-a0d1847f7f31'::uuid, 'rear_delts'),
  ('019e0675-a985-70f6-8b40-1c1e28601323'::uuid, 'front_delts'),
  ('019e0675-a9b4-771c-b3c8-a6219f99df89'::uuid, 'front_delts'),
  ('019e0675-a9b6-7f1a-9aa0-77c276625d08'::uuid, 'front_delts'),
  ('019e0675-a9f4-7744-a47f-ad6d90b2bb0e'::uuid, 'side_delts'),
  ('019e0675-aa15-72ce-9de6-6b9d452a83ff'::uuid, 'front_delts'),
  ('019e0675-aa1e-7e06-9389-ec8c1ac04f74'::uuid, 'side_delts'),
  ('019e0675-aa5e-7285-9797-3b2140ea4cda'::uuid, 'front_delts'),
  ('019e0675-aa81-756a-a901-304358d6b766'::uuid, 'rear_delts'),
  ('019e0675-aa81-7c37-920c-8ca0b39655ae'::uuid, 'front_delts'),
  ('019e0675-aaac-7cc9-9c00-9440ac451ff5'::uuid, 'front_delts'),
  ('019e0675-aaaf-709c-b66b-46f651d3de44'::uuid, 'side_delts'),
  ('019e0675-ab0c-7ea8-a50a-b149a5ffbd01'::uuid, 'front_delts'),
  ('019e0675-ab1d-7aad-b45e-53d91b7bb304'::uuid, 'front_delts'),
  ('019e0675-ab26-72bd-b0a4-36715fe29572'::uuid, 'front_delts'),
  ('019e0675-ab3b-7fe8-8b83-f41d3db41b22'::uuid, 'front_delts'),
  ('019e0675-ab44-7ef1-890c-785fb3e83ee8'::uuid, 'front_delts'),
  ('019e0675-ab59-7cc8-b856-bfcb7ef81e2e'::uuid, 'front_delts'),
  ('019e0675-ab70-779a-b120-c10e36843869'::uuid, 'side_delts'),
  ('019e0675-ab72-7eea-9a67-4dd93321abe4'::uuid, 'front_delts'),
  ('019e0675-ab8c-79d7-8b6f-c71cabe039df'::uuid, 'front_delts'),
  ('019e0675-ab8d-7090-a3a2-9f0b775071e8'::uuid, 'front_delts'),
  ('019e0675-ac3b-7a5a-8d65-567ebc98d521'::uuid, 'front_delts'),
  ('019e0675-ac42-77fb-9992-8086e1b49b0f'::uuid, 'side_delts')
) AS mapping(id, target)
WHERE e.id = mapping.id AND e.is_public AND e.primary_muscle_group = 'shoulders';

UPDATE public.exercise_secondary_muscle_groups AS sm SET muscle_group = mapping.target
FROM (VALUES
  ('019e0675-a776-7ed4-ad6b-230dafacbc34'::uuid, 'front_delts'),
  ('019e0675-aab5-78bd-a46c-ed7f3d6291b1'::uuid, 'side_delts'),
  ('019e0675-ab56-7fc2-bfb9-1982f572c403'::uuid, 'side_delts'),
  ('019e0675-ac4a-77ba-b98b-fed5bdb31bba'::uuid, 'side_delts'),
  ('019e0675-ac51-7bd0-a2d2-40f9092835ec'::uuid, 'side_delts'),
  ('019e0675-a20a-7d84-ac89-79cb77133e51'::uuid, 'front_delts'),
  ('019e0675-a26c-7b80-9fda-9075c6c51b8b'::uuid, 'front_delts'),
  ('019e0675-a287-7b10-8e34-ea4817e1fc8a'::uuid, 'front_delts'),
  ('019e0675-a289-7690-a8f7-57bf99de5e06'::uuid, 'front_delts'),
  ('019e0675-a2be-79b1-ac10-d4bc6fd7b112'::uuid, 'front_delts'),
  ('019e0675-a2cb-7dcc-88d3-cc604dc1152d'::uuid, 'front_delts'),
  ('019e0675-a2cc-7635-9c04-13e5f4557c62'::uuid, 'front_delts'),
  ('019e0675-a2cc-7f64-9473-c9121e2f447a'::uuid, 'front_delts'),
  ('019e0675-a2e0-7405-a6ef-9c2822bef44d'::uuid, 'rear_delts'),
  ('019e0675-a2ea-7dd6-8f8b-3f08e1f05b29'::uuid, 'rear_delts'),
  ('019e0675-a302-7385-a5f2-e7d28ad2937b'::uuid, 'front_delts'),
  ('019e0675-a337-762a-a018-3a407e128bd5'::uuid, 'front_delts'),
  ('019e0675-a3fa-70f6-bd0d-2ffea2a77a4f'::uuid, 'front_delts'),
  ('019e0675-a3fb-78f9-a7dc-3afe57f220d4'::uuid, 'front_delts'),
  ('019e0675-a3fd-72f9-a973-74c4adb1753f'::uuid, 'front_delts'),
  ('019e0675-a3ff-78fe-a88f-694f46cc22ee'::uuid, 'front_delts'),
  ('019e0675-a40d-7160-9af8-73292449d86b'::uuid, 'front_delts'),
  ('019e0675-a440-79a4-9311-bb5c0026e002'::uuid, 'front_delts'),
  ('019e0675-a44c-777d-b0d8-eca163c4c6a2'::uuid, 'front_delts'),
  ('019e0675-a458-7d01-88bc-b986e690d578'::uuid, 'front_delts'),
  ('019e0675-a45b-7712-9c70-245dc3c28c76'::uuid, 'front_delts'),
  ('019e0675-a466-7eb7-bf7f-e365822e7843'::uuid, 'front_delts'),
  ('019e0675-a472-725c-8b9d-c378d8d1ddd5'::uuid, 'front_delts'),
  ('019e0675-a472-792c-a9a5-2b50d3650996'::uuid, 'front_delts'),
  ('019e0675-a48b-77b0-bb46-f55b46dd2806'::uuid, 'front_delts'),
  ('019e0675-a493-72f5-bfd0-34c3faf8a61c'::uuid, 'front_delts'),
  ('019e0675-a49a-7b4c-8f1f-f12efff50830'::uuid, 'front_delts'),
  ('019e0675-a4a1-7a16-ab9d-947d5867f5b6'::uuid, 'rear_delts'),
  ('019e0675-a50f-754d-bcf2-17bc377a8150'::uuid, 'front_delts'),
  ('019e0675-a536-7906-b51e-6c9165e266aa'::uuid, 'front_delts'),
  ('019e0675-a537-775a-9786-de994c9f75a3'::uuid, 'front_delts'),
  ('019e0675-a597-76fb-bf76-527b073d6dc6'::uuid, 'front_delts'),
  ('019e0675-a5e9-7b5e-b89e-e61d2b205691'::uuid, 'front_delts'),
  ('019e0675-a5eb-7e7d-8ce8-f4c4be74ba8e'::uuid, 'front_delts'),
  ('019e0675-a5f6-724b-9ae1-cda7674d1e1f'::uuid, 'front_delts'),
  ('019e0675-a600-7edb-aba2-59fa70f9af8b'::uuid, 'front_delts'),
  ('019e0675-a604-7262-95fe-0ff1c0f72e03'::uuid, 'front_delts'),
  ('019e0675-a605-7049-8658-9ee5db5a1eaa'::uuid, 'front_delts'),
  ('019e0675-a606-7d05-981a-e67623f2ebc9'::uuid, 'front_delts'),
  ('019e0675-a608-73ff-9222-3bd990469663'::uuid, 'front_delts'),
  ('019e0675-a60c-7d7e-87ae-aca2d764e3fd'::uuid, 'front_delts'),
  ('019e0675-a6ae-737b-b07b-30e22f81fbde'::uuid, 'front_delts'),
  ('019e0675-a6bd-72e0-9396-e7a353e43956'::uuid, 'front_delts'),
  ('019e0675-a6cb-7357-8a01-87bc9a8071e9'::uuid, 'front_delts'),
  ('019e0675-a6d0-7b25-af3e-0e931ba1d471'::uuid, 'front_delts'),
  ('019e0675-a732-7011-b661-c5209ffad994'::uuid, 'front_delts'),
  ('019e0675-a785-775d-9649-43e266b7092f'::uuid, 'rear_delts'),
  ('019e0675-a7d2-760b-85b0-591dc38405c7'::uuid, 'front_delts'),
  ('019e0675-a7d7-7e32-813f-08eddc3fb955'::uuid, 'front_delts'),
  ('019e0675-a822-7e09-8d41-f4cdc86fa4e8'::uuid, 'front_delts'),
  ('019e0675-a838-7469-a3c6-f6eaf00b546c'::uuid, 'front_delts'),
  ('019e0675-a856-7d50-b345-dccb6d264dec'::uuid, 'front_delts'),
  ('019e0675-a858-7aca-9eb5-92ce2db618e1'::uuid, 'front_delts'),
  ('019e0675-a89b-7ff5-b189-06deda22059a'::uuid, 'front_delts'),
  ('019e0675-a8a0-7536-8686-d89337c50086'::uuid, 'front_delts'),
  ('019e0675-a8a1-71f9-a190-1c1896d6a74a'::uuid, 'front_delts'),
  ('019e0675-a8a7-7d32-923d-1b9f4523a1e6'::uuid, 'front_delts'),
  ('019e0675-a8bb-7542-b9d4-6433cdc93449'::uuid, 'front_delts'),
  ('019e0675-a8bb-79a8-9249-3dc7dcf911b3'::uuid, 'front_delts'),
  ('019e0675-a8f1-7cae-a02a-f75e2023c523'::uuid, 'front_delts'),
  ('019e0675-a917-7847-b282-8f2b876d470b'::uuid, 'rear_delts'),
  ('019e0675-a91e-7004-bde4-05dde6488639'::uuid, 'front_delts'),
  ('019e0675-a930-7662-8405-e5a70d34c18d'::uuid, 'front_delts'),
  ('019e0675-a97f-7dfd-9714-6fb6b5cc08c7'::uuid, 'rear_delts'),
  ('019e0675-aa4d-7a2e-b436-d6e0ad176cc5'::uuid, 'front_delts'),
  ('019e0675-aa92-74c1-8b8e-e9fb2204c7d1'::uuid, 'rear_delts'),
  ('019e0675-aa92-797c-a653-f972288ca3e0'::uuid, 'front_delts'),
  ('019e0675-aa98-77c2-b7bb-cd3c1008349d'::uuid, 'front_delts'),
  ('019e0675-aa98-7840-bf46-e28c92a6bc32'::uuid, 'front_delts'),
  ('019e0675-aa99-7e61-b80d-427aa230fc50'::uuid, 'front_delts'),
  ('019e0675-ab2a-7f6d-8c00-f8317a19213d'::uuid, 'front_delts'),
  ('019e0675-abec-7793-b699-8a6089dc8033'::uuid, 'front_delts'),
  ('019e0675-ac6b-7cef-8cf0-4cadce763fed'::uuid, 'front_delts'),
  ('019e0675-ac7e-7dbd-b1de-e895636db371'::uuid, 'front_delts'),
  ('019e0675-ac8a-73df-a146-fa8e34824600'::uuid, 'front_delts')
) AS mapping(id, target)
JOIN public.exercises AS e ON e.id = mapping.id AND e.is_public
WHERE sm.exercise_id = mapping.id AND sm.muscle_group = 'shoulders'
  AND e.primary_muscle_group <> mapping.target;

DELETE FROM public.exercise_secondary_muscle_groups AS sm USING (VALUES
  ('019e0675-a776-7ed4-ad6b-230dafacbc34'::uuid, 'front_delts'),
  ('019e0675-aab5-78bd-a46c-ed7f3d6291b1'::uuid, 'side_delts'),
  ('019e0675-ab56-7fc2-bfb9-1982f572c403'::uuid, 'side_delts'),
  ('019e0675-ac4a-77ba-b98b-fed5bdb31bba'::uuid, 'side_delts'),
  ('019e0675-ac51-7bd0-a2d2-40f9092835ec'::uuid, 'side_delts'),
  ('019e0675-a20a-7d84-ac89-79cb77133e51'::uuid, 'front_delts'),
  ('019e0675-a26c-7b80-9fda-9075c6c51b8b'::uuid, 'front_delts'),
  ('019e0675-a287-7b10-8e34-ea4817e1fc8a'::uuid, 'front_delts'),
  ('019e0675-a289-7690-a8f7-57bf99de5e06'::uuid, 'front_delts'),
  ('019e0675-a2be-79b1-ac10-d4bc6fd7b112'::uuid, 'front_delts'),
  ('019e0675-a2cb-7dcc-88d3-cc604dc1152d'::uuid, 'front_delts'),
  ('019e0675-a2cc-7635-9c04-13e5f4557c62'::uuid, 'front_delts'),
  ('019e0675-a2cc-7f64-9473-c9121e2f447a'::uuid, 'front_delts'),
  ('019e0675-a2e0-7405-a6ef-9c2822bef44d'::uuid, 'rear_delts'),
  ('019e0675-a2ea-7dd6-8f8b-3f08e1f05b29'::uuid, 'rear_delts'),
  ('019e0675-a302-7385-a5f2-e7d28ad2937b'::uuid, 'front_delts'),
  ('019e0675-a337-762a-a018-3a407e128bd5'::uuid, 'front_delts'),
  ('019e0675-a3fa-70f6-bd0d-2ffea2a77a4f'::uuid, 'front_delts'),
  ('019e0675-a3fb-78f9-a7dc-3afe57f220d4'::uuid, 'front_delts'),
  ('019e0675-a3fd-72f9-a973-74c4adb1753f'::uuid, 'front_delts'),
  ('019e0675-a3ff-78fe-a88f-694f46cc22ee'::uuid, 'front_delts'),
  ('019e0675-a40d-7160-9af8-73292449d86b'::uuid, 'front_delts'),
  ('019e0675-a440-79a4-9311-bb5c0026e002'::uuid, 'front_delts'),
  ('019e0675-a44c-777d-b0d8-eca163c4c6a2'::uuid, 'front_delts'),
  ('019e0675-a458-7d01-88bc-b986e690d578'::uuid, 'front_delts'),
  ('019e0675-a45b-7712-9c70-245dc3c28c76'::uuid, 'front_delts'),
  ('019e0675-a466-7eb7-bf7f-e365822e7843'::uuid, 'front_delts'),
  ('019e0675-a472-725c-8b9d-c378d8d1ddd5'::uuid, 'front_delts'),
  ('019e0675-a472-792c-a9a5-2b50d3650996'::uuid, 'front_delts'),
  ('019e0675-a48b-77b0-bb46-f55b46dd2806'::uuid, 'front_delts'),
  ('019e0675-a493-72f5-bfd0-34c3faf8a61c'::uuid, 'front_delts'),
  ('019e0675-a49a-7b4c-8f1f-f12efff50830'::uuid, 'front_delts'),
  ('019e0675-a4a1-7a16-ab9d-947d5867f5b6'::uuid, 'rear_delts'),
  ('019e0675-a50f-754d-bcf2-17bc377a8150'::uuid, 'front_delts'),
  ('019e0675-a536-7906-b51e-6c9165e266aa'::uuid, 'front_delts'),
  ('019e0675-a537-775a-9786-de994c9f75a3'::uuid, 'front_delts'),
  ('019e0675-a597-76fb-bf76-527b073d6dc6'::uuid, 'front_delts'),
  ('019e0675-a5e9-7b5e-b89e-e61d2b205691'::uuid, 'front_delts'),
  ('019e0675-a5eb-7e7d-8ce8-f4c4be74ba8e'::uuid, 'front_delts'),
  ('019e0675-a5f6-724b-9ae1-cda7674d1e1f'::uuid, 'front_delts'),
  ('019e0675-a600-7edb-aba2-59fa70f9af8b'::uuid, 'front_delts'),
  ('019e0675-a604-7262-95fe-0ff1c0f72e03'::uuid, 'front_delts'),
  ('019e0675-a605-7049-8658-9ee5db5a1eaa'::uuid, 'front_delts'),
  ('019e0675-a606-7d05-981a-e67623f2ebc9'::uuid, 'front_delts'),
  ('019e0675-a608-73ff-9222-3bd990469663'::uuid, 'front_delts'),
  ('019e0675-a60c-7d7e-87ae-aca2d764e3fd'::uuid, 'front_delts'),
  ('019e0675-a6ae-737b-b07b-30e22f81fbde'::uuid, 'front_delts'),
  ('019e0675-a6bd-72e0-9396-e7a353e43956'::uuid, 'front_delts'),
  ('019e0675-a6cb-7357-8a01-87bc9a8071e9'::uuid, 'front_delts'),
  ('019e0675-a6d0-7b25-af3e-0e931ba1d471'::uuid, 'front_delts'),
  ('019e0675-a732-7011-b661-c5209ffad994'::uuid, 'front_delts'),
  ('019e0675-a785-775d-9649-43e266b7092f'::uuid, 'rear_delts'),
  ('019e0675-a7d2-760b-85b0-591dc38405c7'::uuid, 'front_delts'),
  ('019e0675-a7d7-7e32-813f-08eddc3fb955'::uuid, 'front_delts'),
  ('019e0675-a822-7e09-8d41-f4cdc86fa4e8'::uuid, 'front_delts'),
  ('019e0675-a838-7469-a3c6-f6eaf00b546c'::uuid, 'front_delts'),
  ('019e0675-a856-7d50-b345-dccb6d264dec'::uuid, 'front_delts'),
  ('019e0675-a858-7aca-9eb5-92ce2db618e1'::uuid, 'front_delts'),
  ('019e0675-a89b-7ff5-b189-06deda22059a'::uuid, 'front_delts'),
  ('019e0675-a8a0-7536-8686-d89337c50086'::uuid, 'front_delts'),
  ('019e0675-a8a1-71f9-a190-1c1896d6a74a'::uuid, 'front_delts'),
  ('019e0675-a8a7-7d32-923d-1b9f4523a1e6'::uuid, 'front_delts'),
  ('019e0675-a8bb-7542-b9d4-6433cdc93449'::uuid, 'front_delts'),
  ('019e0675-a8bb-79a8-9249-3dc7dcf911b3'::uuid, 'front_delts'),
  ('019e0675-a8f1-7cae-a02a-f75e2023c523'::uuid, 'front_delts'),
  ('019e0675-a917-7847-b282-8f2b876d470b'::uuid, 'rear_delts'),
  ('019e0675-a91e-7004-bde4-05dde6488639'::uuid, 'front_delts'),
  ('019e0675-a930-7662-8405-e5a70d34c18d'::uuid, 'front_delts'),
  ('019e0675-a97f-7dfd-9714-6fb6b5cc08c7'::uuid, 'rear_delts'),
  ('019e0675-aa4d-7a2e-b436-d6e0ad176cc5'::uuid, 'front_delts'),
  ('019e0675-aa92-74c1-8b8e-e9fb2204c7d1'::uuid, 'rear_delts'),
  ('019e0675-aa92-797c-a653-f972288ca3e0'::uuid, 'front_delts'),
  ('019e0675-aa98-77c2-b7bb-cd3c1008349d'::uuid, 'front_delts'),
  ('019e0675-aa98-7840-bf46-e28c92a6bc32'::uuid, 'front_delts'),
  ('019e0675-aa99-7e61-b80d-427aa230fc50'::uuid, 'front_delts'),
  ('019e0675-ab2a-7f6d-8c00-f8317a19213d'::uuid, 'front_delts'),
  ('019e0675-abec-7793-b699-8a6089dc8033'::uuid, 'front_delts'),
  ('019e0675-ac6b-7cef-8cf0-4cadce763fed'::uuid, 'front_delts'),
  ('019e0675-ac7e-7dbd-b1de-e895636db371'::uuid, 'front_delts'),
  ('019e0675-ac8a-73df-a146-fa8e34824600'::uuid, 'front_delts')
) AS mapping(id, target), public.exercises AS e
WHERE sm.exercise_id = mapping.id AND e.id = mapping.id AND e.is_public
  AND sm.muscle_group = 'shoulders' AND e.primary_muscle_group = mapping.target;

-- Hasura custom functions return a tracked relation. This is a read-only row
-- shape, not a cache; application users have no insert/update/delete permission.
CREATE TABLE public.muscle_set_progress_rows (
  user_id uuid NOT NULL,
  day date NOT NULL,
  muscle_group text NOT NULL,
  direct_sets integer NOT NULL,
  indirect_sets integer NOT NULL,
  weighted_sets numeric NOT NULL,
  rolling_direct_sets integer NOT NULL,
  rolling_indirect_sets integer NOT NULL,
  rolling_weighted_sets numeric NOT NULL,
  CONSTRAINT muscle_set_progress_rows_no_storage CHECK (false)
);

CREATE FUNCTION public.muscle_set_progress(
  from_day date, through_day date, time_zone text, hasura_session json
) RETURNS SETOF public.muscle_set_progress_rows
LANGUAGE plpgsql STABLE AS $$
DECLARE
  owner_id uuid;
BEGIN
  owner_id := (hasura_session ->> 'x-hasura-user-id')::uuid;
  IF owner_id IS NULL OR from_day IS NULL OR through_day IS NULL
     OR through_day < from_day OR through_day - from_day > 365
     OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = time_zone) THEN
    RAISE EXCEPTION 'Invalid progress range or time zone' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  -- Read eligible sets once; primary and secondary credits share the same owner/date filter.
  WITH base_sets AS MATERIALIZED (
    SELECT (ws.started_at AT TIME ZONE time_zone)::date AS local_day,
           e.id AS exercise_id, e.primary_muscle_group
    FROM public.workout_sessions ws
    JOIN public.workout_session_exercises wse ON wse.workout_session_id = ws.id
    JOIN public.workout_session_strength_sets ss ON ss.workout_session_exercise_id = wse.id
    JOIN public.exercises e ON e.id = wse.exercise_id
    WHERE ws.user_id = owner_id AND ss.reps > 0
      AND ws.started_at >= ((from_day - 6)::timestamp AT TIME ZONE time_zone)
      AND ws.started_at < ((through_day + 1)::timestamp AT TIME ZONE time_zone)
  ), set_credits AS (
    SELECT local_day, primary_muscle_group AS muscle, 1 AS direct, 0 AS indirect
    FROM base_sets
    UNION ALL
    SELECT base_sets.local_day, sm.muscle_group, 0, 1
    FROM base_sets
    JOIN public.exercise_secondary_muscle_groups sm ON sm.exercise_id = base_sets.exercise_id
      AND sm.muscle_group <> base_sets.primary_muscle_group
  ), daily AS (
    SELECT local_day, muscle, sum(direct)::integer AS direct_count,
           sum(indirect)::integer AS indirect_count
    FROM set_credits GROUP BY local_day, muscle
  ), dates AS (
    SELECT d::date AS local_day
    FROM generate_series(from_day - 6, through_day, interval '1 day') AS d
  ), filled AS (
    SELECT dates.local_day, muscles.muscle,
           coalesce(daily.direct_count, 0) AS direct_count,
           coalesce(daily.indirect_count, 0) AS indirect_count
    FROM dates CROSS JOIN (SELECT DISTINCT muscle FROM daily) AS muscles
    LEFT JOIN daily ON daily.local_day = dates.local_day AND daily.muscle = muscles.muscle
  ), rolled AS (
    SELECT filled.*,
      (sum(direct_count) OVER w)::integer AS rolling_direct,
      (sum(indirect_count) OVER w)::integer AS rolling_indirect
    FROM filled
    WINDOW w AS (PARTITION BY muscle ORDER BY local_day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)
  )
  SELECT owner_id, rolled.local_day, rolled.muscle,
         rolled.direct_count, rolled.indirect_count,
         rolled.direct_count + rolled.indirect_count * 0.5,
         rolled.rolling_direct, rolled.rolling_indirect,
         rolled.rolling_direct + rolled.rolling_indirect * 0.5
  FROM rolled WHERE rolled.local_day >= from_day
  ORDER BY rolled.local_day, rolled.muscle;
END;
$$;
