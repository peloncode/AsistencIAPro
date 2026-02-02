import {
  View,
  Text,
  ScrollView,
  Alert,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import InputField from "@/components/InputField";
import CustomButton from "@/components/CustomButton";
import {
  CreateStudentSchema,
  CreateStudentSchemaType,
} from "@/schemas/studentSchemas";
import { createStudent, bulkEnrollStudents } from "@/services/student.service";
import { StudentListItem } from "@/types/type";
import { IconTrash } from "@/components/Icons";

export default function AddStudents() {
  const { claseId, materia, seccion } = useLocalSearchParams<{
    claseId: string;
    materia: string;
    seccion: string;
  }>();

  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [isCreatingStudent, setIsCreatingStudent] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateStudentSchemaType>({
    resolver: zodResolver(CreateStudentSchema),
    defaultValues: {
      nombres: "",
      apellidos: "",
      cedula: "",
    },
  });

  const onAddStudent = async (data: CreateStudentSchemaType) => {
    try {
      setIsCreatingStudent(true);

      // Create student on backend
      const response = await createStudent(data);

      // Add to local list
      setStudents((prev) => [
        ...prev,
        {
          id: response.data.id,
          nombres: response.data.nombres,
          apellidos: response.data.apellidos,
          cedula: response.data.cedula,
        },
      ]);

      // Reset form
      reset();

      Alert.alert("✅ Éxito", "Estudiante agregado correctamente");
    } catch (error: any) {
      console.error("Error al agregar estudiante:", error);

      // Check if it's a duplicate cedula error
      const errorMessage = error.response?.data?.message || "";

      if (
        errorMessage.includes("unique constraint") ||
        errorMessage.includes("cedula") ||
        errorMessage.includes("duplicate") ||
        errorMessage.includes("ya existe")
      ) {
        Alert.alert(
          "⚠️ Estudiante Duplicado",
          `Ya existe un estudiante con la cédula "${data.cedula}".\n\nPor favor verifica los datos e intenta con un ID diferente.`,
          [{ text: "Entendido", style: "default" }],
        );
      } else {
        Alert.alert(
          "❌ Error",
          errorMessage ||
            "Error al agregar el estudiante. Por favor intenta nuevamente.",
          [{ text: "Cerrar", style: "cancel" }],
        );
      }
    } finally {
      setIsCreatingStudent(false);
    }
  };

  const removeStudent = (id: number | undefined) => {
    if (!id) return;

    Alert.alert(
      "Confirmar eliminación",
      "¿Estás seguro de eliminar este estudiante de la lista?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            setStudents((prev) => prev.filter((s) => s.id !== id));
          },
        },
      ],
    );
  };

  const onSaveEnrollment = async () => {
    if (students.length === 0) {
      Alert.alert("Error", "Debes agregar al menos un estudiante");
      return;
    }

    try {
      setIsEnrolling(true);

      const studentIds = students
        .map((s) => s.id)
        .filter((id): id is number => id !== undefined);

      const result = await bulkEnrollStudents(
        studentIds,
        parseInt(claseId || "0"),
      );

      if (result.failed > 0) {
        Alert.alert(
          "Advertencia",
          `${result.success} estudiantes inscritos. ${result.failed} fallaron.`,
        );
      }

      // Navigate to success screen
      router.replace({
        pathname: "/success-enrollment",
        params: {
          totalStudents: studentIds.length.toString(),
          materia: materia || "",
          seccion: seccion || "",
        },
      });
    } catch (error: any) {
      console.error("Error al guardar matrícula:", error);
      Alert.alert(
        "Error",
        error.response?.data?.message || "Error al guardar la matrícula",
      );
    } finally {
      setIsEnrolling(false);
    }
  };

  const renderStudentItem = ({ item }: { item: StudentListItem }) => (
    <View className="bg-zinc-800 rounded-lg p-4 mb-3 flex-row items-center justify-between">
      <View className="flex-1">
        <Text className="text-white text-lg font-semibold">
          {item.nombres} {item.apellidos}
        </Text>
        <Text className="text-gray-400 text-sm mt-1">ID: {item.cedula}</Text>
      </View>
      <TouchableOpacity
        onPress={() => removeStudent(item.id)}
        className="bg-red-900 p-3 rounded-lg ml-3"
      >
        <IconTrash />
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="flex-1 bg-gray-900">
      <Stack.Screen
        options={{
          headerTitle: "Agregar Estudiantes",
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
          {/* Subject Info */}
          <View className="bg-sky-950 rounded-lg p-4 mb-6 items-center">
            <View className="bg-sky-800 w-16 h-16 rounded-full items-center justify-center mb-3">
              <Text className="text-white text-2xl">&lt;/&gt;</Text>
            </View>
            <Text className="text-white text-xl font-bold">{materia}</Text>
            <Text className="text-gray-300 text-sm">{seccion}</Text>
          </View>

          {/* Import Options Placeholder */}
          <View className="mb-4">
            <TouchableOpacity
              className="border border-sky-600 rounded-lg p-4 mb-2"
              disabled
            >
              <Text className="text-sky-400 text-center font-semibold">
                📄 Importar Estudiantes
              </Text>
            </TouchableOpacity>

            <View className="flex-row gap-2">
              <TouchableOpacity
                className="flex-1 border border-red-600 rounded-lg p-3"
                disabled
              >
                <Text className="text-red-400 text-center text-sm">
                  📕 Importar desde PDF
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 border border-green-600 rounded-lg p-3"
                disabled
              >
                <Text className="text-green-400 text-center text-sm">
                  📗 Importar desde Excel
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Manual Input Form */}
          <Text className="text-white text-xl font-bold mb-4">
            Formulario de Estudiante
          </Text>

          <InputField
            name="nombres"
            control={control}
            label="Nombre del Estudiante"
            placeholder="Ej: Ana María"
          />

          <InputField
            name="cedula"
            control={control}
            label="ID / Número de Matrícula"
            placeholder="Ej: 28.230.615"
          />

          <InputField
            name="apellidos"
            control={control}
            label="Apellidos"
            placeholder="Ej: García López"
          />

          <CustomButton
            title="Agregar Estudiante"
            onPress={handleSubmit(onAddStudent)}
            isLoading={isCreatingStudent}
            buttonStyles="mb-6"
          />

          {/* Students List */}
          {students.length > 0 && (
            <View className="mb-4">
              <Text className="text-white text-xl font-bold mb-3">
                Estudiantes Agregados ({students.length})
              </Text>
              <FlatList
                data={students}
                renderItem={renderStudentItem}
                keyExtractor={(item, index) =>
                  item.id?.toString() || `temp-${index}`
                }
                scrollEnabled={false}
              />
            </View>
          )}

          {/* Save Button */}
          <CustomButton
            title="Guardar"
            onPress={onSaveEnrollment}
            isLoading={isEnrolling}
            buttonStyles="mb-10"
          />
        </View>
      </ScrollView>
    </View>
  );
}
