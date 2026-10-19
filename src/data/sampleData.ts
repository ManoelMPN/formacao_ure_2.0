import { TeacherGeneral, TeacherTraining } from '../types';

export const SAMPLE_PROFS_GERAL: TeacherGeneral[] = [
  { escola: "EE Prof. Almirante Custódio", nome: "Carlos Eduardo da Silva", cpf: "123.456.789-01", cargo: "PROFESSOR DE ENSINO FUNDAMENTAL E MEDIO" },
  { escola: "EE Prof. Almirante Custódio", nome: "Juliana Santos Ribeiro", cpf: "234.567.890-12", cargo: "PROFESSOR DE ENSINO FUNDAMENTAL E MEDIO" },
  { escola: "EE Prof. Almirante Custódio", nome: "Marcos Paulo de Oliveira", cpf: "345.678.901-23", cargo: "PROFESSOR COORDENADOR" },
  { escola: "EE Prof. Almirante Custódio", nome: "Fernanda Cristina Souza", cpf: "456.789.012-34", cargo: "PROFESSOR DE ENSINO FUNDAMENTAL E MEDIO" },
  
  { escola: "EE Prof. Almirante Custódio", nome: "Renata de Paula Castro", cpf: "567.890.123-45", cargo: "PROFESSOR DE ENSINO FUNDAMENTAL E MEDIO" },
  { escola: "EE Prof. Almirante Custódio", nome: "Thiago Henrique Mendes", cpf: "678.901.234-56", cargo: "PROFESSOR DE ENSINO FUNDAMENTAL E MEDIO" },
  { escola: "EE Prof. Almirante Custódio", nome: "Aline Beatriz Ferreira", cpf: "789.012.345-67", cargo: "PROFESSOR DE ENSINO FUNDAMENTAL E MEDIO" },
  { escola: "EE Prof. Almirante Custódio", nome: "Lucas Gabriel Nascimento", cpf: "890.123.456-78", cargo: "PROFESSOR DE ENSINO FUNDAMENTAL E MEDIO" },

  { escola: "EE Prof. Lourival Gomes Machado", nome: "Patricia Helena Lima", cpf: "901.234.567-89", cargo: "PROFESSOR DE ENSINO FUNDAMENTAL E MEDIO" },
  { escola: "EE Prof. Lourival Gomes Machado", nome: "Rodrigo Almeida Pires", cpf: "012.345.678-90", cargo: "PROFESSOR DE ENSINO FUNDAMENTAL E MEDIO" },
  { escola: "EE Prof. Lourival Gomes Machado", nome: "Camila Duarte Martins", cpf: "111.222.333-44", cargo: "PROFESSOR COORDENADOR" },

  { escola: "EE Dr. Tancredo Neves", nome: "Fabio Junior de Assis", cpf: "222.333.444-55", cargo: "PROFESSOR DE ENSINO FUNDAMENTAL E MEDIO" },
  { escola: "EE Dr. Tancredo Neves", nome: "Mariana Costa Nogueira", cpf: "333.444.555-66", cargo: "PROFESSOR DE ENSINO FUNDAMENTAL E MEDIO" },
  { escola: "EE Dr. Tancredo Neves", nome: "Diego Rodrigues Ramos", cpf: "444.555.666-77", cargo: "PROFESSOR DE ENSINO FUNDAMENTAL E MEDIO" },

  { escola: "EE Reverendo Tércio", nome: "Vanessa Lemos Pinheiro", cpf: "555.666.777-88", cargo: "PROFESSOR DE ENSINO FUNDAMENTAL E MEDIO" },
  { escola: "EE Reverendo Tércio", nome: "Bruno Cesar Morais", cpf: "666.777.888-99", cargo: "PROFESSOR DE ENSINO FUNDAMENTAL E MEDIO" },
  { escola: "EE Reverendo Tércio", nome: "Sabrina Rocha Fonseca", cpf: "777.888.999-00", cargo: "PROFESSOR DE ENSINO FUNDAMENTAL E MEDIO" },

  { escola: "EE Jardim São Bento", nome: "Leandro Victor Vieira", cpf: "888.999.000-11", cargo: "PROFESSOR DE ENSINO FUNDAMENTAL E MEDIO" },
  { escola: "EE Jardim São Bento", nome: "Tatiane Moreira Barbosa", cpf: "999.000.111-22", cargo: "PROFESSOR DE ENSINO FUNDAMENTAL E MEDIO" },
  { escola: "EE Jardim São Bento", nome: "Guilherme Santos Prado", cpf: "101.202.303-44", cargo: "PROFESSOR DE ENSINO FUNDAMENTAL E MEDIO" },
];

export const SAMPLE_PROGRAMACAO_RAW = [
  { cpf: "123.456.789-01", docente: "Carlos Eduardo da Silva", area: "Ciências da Natureza e Matemática", previstos: 8, concluidos: 8, concluidoStatus: "SIM" },
  { cpf: "234.567.890-12", docente: "Juliana Santos Ribeiro", area: "Matemática", previstos: 8, concluidos: 6, concluidoStatus: "NÃO" },
  { cpf: "567.890.123-45", docente: "Renata de Paula Castro", area: "Ciências e Tecnologia", previstos: 8, concluidos: 8, concluidoStatus: "SIM" },
  { cpf: "678.901.234-56", docente: "Thiago Henrique Mendes", area: "Informática Educativa", previstos: 8, concluidos: 4, concluidoStatus: "NÃO" },
  { cpf: "901.234.567-89", docente: "Patricia Helena Lima", area: "Linguagens e Códigos", previstos: 8, concluidos: 8, concluidoStatus: "SIM" },
  { cpf: "012.345.678-90", docente: "Rodrigo Almeida Pires", area: "Matemática", previstos: 8, concluidos: 7, concluidoStatus: "NÃO" },
  { cpf: "222.333.444-55", docente: "Fabio Junior de Assis", area: "Ciências da Computação", previstos: 8, concluidos: 8, concluidoStatus: "SIM" },
  { cpf: "333.444.555-66", docente: "Mariana Costa Nogueira", area: "Ciências da Natureza", previstos: 8, concluidos: 3, concluidoStatus: "NÃO" },
  { cpf: "555.666.777-88", docente: "Vanessa Lemos Pinheiro", area: "Física", previstos: 8, concluidos: 8, concluidoStatus: "SIM" },
  { cpf: "666.777.888-99", docente: "Bruno Cesar Morais", area: "Matemática", previstos: 8, concluidos: 5, concluidoStatus: "NÃO" },
  { cpf: "888.999.000-11", docente: "Leandro Victor Vieira", area: "Tecnologia e Inovação", previstos: 8, concluidos: 8, concluidoStatus: "SIM" },
  { cpf: "999.000.111-22", docente: "Tatiane Moreira Barbosa", area: "Matemática", previstos: 8, concluidos: 2, concluidoStatus: "NÃO" },
];

export const SAMPLE_ROBOTICA_RAW = [
  { cpf: "345.678.901-23", docente: "Marcos Paulo de Oliveira", area: "Robótica e Inovação", previstos: 6, concluidos: 6, concluidoStatus: "SIM" },
  { cpf: "456.789.012-34", docente: "Fernanda Cristina Souza", area: "Ciências", previstos: 6, concluidos: 6, concluidoStatus: "SIM" },
  { cpf: "789.012.345-67", docente: "Aline Beatriz Ferreira", area: "Física", previstos: 6, concluidos: 4, concluidoStatus: "NÃO" },
  { cpf: "890.123.456-78", docente: "Lucas Gabriel Nascimento", area: "Tecnologia", previstos: 6, concluidos: 6, concluidoStatus: "SIM" },
  { cpf: "111.222.333-44", docente: "Camila Duarte Martins", area: "Matemática", previstos: 6, concluidos: 5, concluidoStatus: "NÃO" },
  { cpf: "444.555.666-77", docente: "Diego Rodrigues Ramos", area: "Física e Robótica", previstos: 6, concluidos: 6, concluidoStatus: "SIM" },
  { cpf: "777.888.999-00", docente: "Sabrina Rocha Fonseca", area: "Ciências da Natureza", previstos: 6, concluidos: 3, concluidoStatus: "NÃO" },
  { cpf: "101.202.303-44", docente: "Guilherme Santos Prado", area: "Tecnologia", previstos: 6, concluidos: 6, concluidoStatus: "SIM" },
  { cpf: "123.456.789-01", docente: "Carlos Eduardo da Silva", area: "Ciências da Computação", previstos: 6, concluidos: 6, concluidoStatus: "SIM" },
  { cpf: "567.890.123-45", docente: "Renata de Paula Castro", area: "Tecnologia", previstos: 6, concluidos: 6, concluidoStatus: "SIM" },
];

export const SAMPLE_FORMADOS_RAW = [
  { cpf: "123.456.789-01", docente: "Carlos Eduardo da Silva", componente: "Programação" },
  { cpf: "234.567.890-12", docente: "Juliana Santos Ribeiro", componente: "Programação" },
  { cpf: "678.901.234-56", docente: "Thiago Henrique Mendes", componente: "Programação" },
  { cpf: "999.000.111-22", docente: "Tatiane Moreira Barbosa", componente: "Programação" },
  { cpf: "345.678.901-23", docente: "Marcos Paulo de Oliveira", componente: "Robótica" },
  { cpf: "789.012.345-67", docente: "Aline Beatriz Ferreira", componente: "Robótica" },
  { cpf: "111.222.333-44", docente: "Camila Duarte Martins", componente: "Robótica" },
  // Exemplo de nome parecido na formação presencial:
  { cpf: "", docente: "Rodrigo A. Pires", componente: "Programação" },
  // Exemplo de nome da formação presencial que não bate com o BI Escola Total:
  { cpf: "", docente: "Marcio Roberto Guimarães", componente: "Tecnologia e Inovação" },
];

