-- Moto como segmento próprio.
--
-- Antes caía em "auto", que mistura carro e moto no mesmo balde: na carteira e
-- no painel o ticket médio de automóvel saía puxado para baixo pelas motos, e a
-- proposta escrevia "Veículo" onde devia escrever "Moto".
--
-- Postgres não deixa usar um valor novo de enum na mesma transação em que ele é
-- criado, por isso o add vem sozinho nesta migração.

alter type segmento_consorcio add value if not exists 'moto' after 'auto';
