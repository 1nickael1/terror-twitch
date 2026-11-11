// Recebe o resultado de GLTFLoader.loadAsync('fechadura-nivel1-variantes.glb').
// Prepara ambos os materiais uma vez; a troca de estado é síncrona, sem baixar outra malha.
export async function prepararEstadosFechadura(gltf) {
  const materiais = await gltf.parser.getDependencies('material');
  const bloqueada = materiais.find(m => m.name === 'Fechadura_N1_Bloqueada');
  const liberada = materiais.find(m => m.name === 'Fechadura_N1_Liberada');
  if (!bloqueada || !liberada) throw new Error('Carregue fechadura-nivel1-variantes.glb para alternar os estados.');
  return function definirLiberada(valor) {
    gltf.scene.traverse(obj => {
      if (obj.isMesh) obj.material = valor ? liberada : bloqueada;
    });
  };
}
