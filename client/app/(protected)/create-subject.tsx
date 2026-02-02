import { View, Text, ScrollView, Alert } from "react-native";
import { Stack, router } from "expo-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import InputField from "@/components/InputField";
import CustomButton from "@/components/CustomButton";
import {
  CreateSubjectSchema,
  CreateSubjectSchemaType,
} from "@/schemas/subjectSchemas";
import {
  createMateria,
  createSeccion,
  createClase,
} from "@/services/subject.service";

export default function CreateSubject() {
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateSubjectSchemaType>({
    resolver: zodResolver(CreateSubjectSchema),
    defaultValues: {
      nombre: "",
      semestre: "",
      seccion: "",
    },
  });

  const onSubmit = async (data: CreateSubjectSchemaType) => {
    setIsLoading(true);

    // 1. Create or get Materia
    const materiaResponse = await createMateria(data.nombre);
    const materiaId = materiaResponse.data.id;

    // 2. Create or get Seccion
    const seccionResponse = await createSeccion(data.seccion, data.semestre);
    const seccionId = seccionResponse.data.id;

    // 3. Create Clase (relationship)
    const claseResponse = await createClase(materiaId, seccionId);
    const claseId = claseResponse.data.id;

    // Navigate to add students screen
    router.push({
      pathname: "/add-students",
      params: {
        claseId: claseId.toString(),
        materia: data.nombre,
        seccion: data.seccion,
      },
    });
  };

  return (
    <View className="flex-1 bg-gray-900">
      <Stack.Screen
        options={{
          headerTitle: "Crear Nueva Materia",
          headerStyle: {
            backgroundColor: "#111827",
          },
          headerTintColor: "#fff",
        }}
      />

      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="py-6">
          <InputField
            name="nombre"
            control={control}
            label="Nombre de la Materia"
            placeholder="Ej: Cálculo Diferencial"
          />

          <InputField
            name="semestre"
            control={control}
            label="Semestre"
            placeholder="Ej: 6to Semestre"
          />

          <InputField
            name="seccion"
            control={control}
            label="Sección"
            placeholder="Ej: 076-2630-D1"
          />

          <View className="mt-10">
            <CustomButton
              title="Crear Materia"
              onPress={handleSubmit(onSubmit)}
              isLoading={isLoading}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
