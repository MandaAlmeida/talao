export type EnderecoPorCep = {
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
};

type ViaCepResponse = {
  erro?: boolean | "true";
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

export async function buscarCep(cep: string): Promise<EnderecoPorCep | null> {
  const digitos = cep.replace(/\D/g, "");
  if (digitos.length !== 8) return null;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
    if (!response.ok) return null;

    const dados = (await response.json()) as ViaCepResponse;
    if (dados.erro) return null;

    return {
      rua: dados.logradouro ?? "",
      bairro: dados.bairro ?? "",
      cidade: dados.localidade ?? "",
      estado: dados.uf ?? "",
    };
  } catch {
    return null;
  }
}
